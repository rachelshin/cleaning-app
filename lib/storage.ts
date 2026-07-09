import AsyncStorage from '@react-native-async-storage/async-storage';

export type Task = { id: string; label: string };
export type Habit = {
  id: string;
  label: string;
  done: Record<string, boolean>;
  reward?: string;
};
export type LogEntry = { label: string; date: string };

const TASKS_KEY = 'spinclean:tasks';
const HABITS_KEY = 'spinclean:habits';
const LOG_KEY = 'spinclean:log';
const TREAT_KEY = 'spinclean:treat';
const SUGGEST_DISMISSED_KEY = 'spinclean:suggest-dismissed';
const UPDATED_AT_KEY = 'spinclean:updatedAt';

// ---- Offline-first sync plumbing ----
// AsyncStorage is the source of truth the UI reads/writes instantly.
// Every user edit stamps UPDATED_AT_KEY and pings the sync module (if
// running), which pushes to Firestore in the background. Remote changes
// come in through applyRemoteData, which raw-writes storage and notifies
// screens via onDataChange — deliberately a separate path so a remote
// apply never re-triggers a push.

const dataListeners = new Set<() => void>();

// Screens subscribe to reload their state when sync applies remote data.
export function onDataChange(fn: () => void): () => void {
  dataListeners.add(fn);
  return () => {
    dataListeners.delete(fn);
  };
}

let onLocalChange: (() => void) | null = null;
export function setOnLocalChange(fn: (() => void) | null) {
  onLocalChange = fn;
}

async function touch() {
  await AsyncStorage.setItem(UPDATED_AT_KEY, String(Date.now()));
  onLocalChange?.();
}

export async function getLocalUpdatedAt(): Promise<number> {
  return Number(await AsyncStorage.getItem(UPDATED_AT_KEY)) || 0;
}

// Everything that syncs, as one Firestore document.
export type AppData = {
  tasks: Task[];
  habits: Habit[];
  log: LogEntry[];
  treat: string;
  suggestDismissed: string | null;
  updatedAt: number;
};

export async function collectAllData(): Promise<AppData> {
  return {
    tasks: await loadTasks(),
    habits: await loadHabits(),
    log: await loadLog(),
    treat: await loadTreat(),
    suggestDismissed: await AsyncStorage.getItem(SUGGEST_DISMISSED_KEY),
    updatedAt: await getLocalUpdatedAt(),
  };
}

export async function applyRemoteData(remote: Partial<AppData>) {
  const pairs: [string, string][] = [];
  if (Array.isArray(remote.tasks)) pairs.push([TASKS_KEY, JSON.stringify(remote.tasks)]);
  if (Array.isArray(remote.habits)) pairs.push([HABITS_KEY, JSON.stringify(remote.habits)]);
  if (Array.isArray(remote.log)) pairs.push([LOG_KEY, JSON.stringify(remote.log)]);
  if (typeof remote.treat === 'string') pairs.push([TREAT_KEY, remote.treat]);
  if (typeof remote.suggestDismissed === 'string')
    pairs.push([SUGGEST_DISMISSED_KEY, remote.suggestDismissed]);
  pairs.push([UPDATED_AT_KEY, String(remote.updatedAt ?? Date.now())]);
  await AsyncStorage.multiSet(pairs);
  dataListeners.forEach((fn) => fn());
}

// Drop the local timestamp so the next remote snapshot always wins —
// used when switching to a different account on this device.
export async function resetLocalUpdatedAt() {
  await AsyncStorage.setItem(UPDATED_AT_KEY, '0');
}

// Hidden mechanic — never surfaced in the UI, so doing well never reads as
// "earning more work". Once every habit has quietly held this streak
// (~2 weeks: Lally 2010 — early consistency predicts sticking), the
// add-another-habit suggestion may appear, at random, on ~30% of days.
export const SUGGEST_AFTER_STREAK = 14;
export const SUGGEST_CHANCE = 0.3;

// Deterministic per-date coin flip (FNV-1a hash) so the suggestion doesn't
// flicker in and out across re-renders or app reopens on the same day.
export function dayChance(dateStr: string, p: number): boolean {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000 < p;
}

// Date the user last dismissed the suggestion, so "Not now" sticks all day.
export async function loadSuggestDismissed(): Promise<string | null> {
  return AsyncStorage.getItem(SUGGEST_DISMISSED_KEY);
}

export const saveSuggestDismissed = async (date: string) => {
  await AsyncStorage.setItem(SUGGEST_DISMISSED_KEY, date);
  await touch();
};

export const todayStr = () => new Date().toLocaleDateString('en-CA');

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const DEFAULT_TASKS = [
  'Clean the bathroom counter',
  'Clean the kitchen floor',
  'Clean the floordrobe',
  'Do the dishes',
  'Wipe down the stove',
  'Vacuum the living room',
  'Clean the toilet',
  'Take out trash & recycling',
  'Clear one cluttered surface',
  'Wipe the bathroom mirror',
  'Change the bed sheets',
  'Clean out the fridge',
];

// Baby steps: start with a single habit. More unlock via streaks.
export const DEFAULT_HABITS = ['Do the dishes'];

export async function loadTasks(): Promise<Task[]> {
  const raw = await AsyncStorage.getItem(TASKS_KEY);
  if (raw) return JSON.parse(raw);
  const seeded = DEFAULT_TASKS.map((label) => ({ id: uid(), label }));
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(seeded));
  return seeded;
}

export const saveTasks = async (tasks: Task[]) => {
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  await touch();
};

export async function loadHabits(): Promise<Habit[]> {
  const raw = await AsyncStorage.getItem(HABITS_KEY);
  if (raw) return JSON.parse(raw);
  const seeded = DEFAULT_HABITS.map((label) => ({ id: uid(), label, done: {} }));
  await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(seeded));
  return seeded;
}

export const saveHabits = async (habits: Habit[]) => {
  await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  await touch();
};

export async function loadLog(): Promise<LogEntry[]> {
  const raw = await AsyncStorage.getItem(LOG_KEY);
  return raw ? JSON.parse(raw) : [];
}

export const saveLog = async (log: LogEntry[]) => {
  await AsyncStorage.setItem(LOG_KEY, JSON.stringify(log));
  await touch();
};

// The treat the user promises themselves for finishing a wheel task.
export async function loadTreat(): Promise<string> {
  return (await AsyncStorage.getItem(TREAT_KEY)) ?? '';
}

export const saveTreat = async (treat: string) => {
  await AsyncStorage.setItem(TREAT_KEY, treat);
  await touch();
};

// Consecutive days done, counting back from today (or yesterday if today isn't done yet).
export function streak(done: Record<string, boolean>): number {
  let count = 0;
  const d = new Date();
  if (!done[d.toLocaleDateString('en-CA')]) d.setDate(d.getDate() - 1);
  while (done[d.toLocaleDateString('en-CA')]) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

// Local-time date strings for the last n days, oldest first, ending today.
export function lastNDays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    out.unshift(d.toLocaleDateString('en-CA'));
    d.setDate(d.getDate() - 1);
  }
  return out;
}

export function weekCount(log: LogEntry[]): number {
  const week = new Set(lastNDays(7));
  return log.filter((e) => week.has(e.date)).length;
}
