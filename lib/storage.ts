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

export const saveSuggestDismissed = (date: string) =>
  AsyncStorage.setItem(SUGGEST_DISMISSED_KEY, date);

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

export const saveTasks = (tasks: Task[]) =>
  AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));

export async function loadHabits(): Promise<Habit[]> {
  const raw = await AsyncStorage.getItem(HABITS_KEY);
  if (raw) return JSON.parse(raw);
  const seeded = DEFAULT_HABITS.map((label) => ({ id: uid(), label, done: {} }));
  await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(seeded));
  return seeded;
}

export const saveHabits = (habits: Habit[]) =>
  AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits));

export async function loadLog(): Promise<LogEntry[]> {
  const raw = await AsyncStorage.getItem(LOG_KEY);
  return raw ? JSON.parse(raw) : [];
}

export const saveLog = (log: LogEntry[]) =>
  AsyncStorage.setItem(LOG_KEY, JSON.stringify(log));

// The treat the user promises themselves for finishing a wheel task.
export async function loadTreat(): Promise<string> {
  return (await AsyncStorage.getItem(TREAT_KEY)) ?? '';
}

export const saveTreat = (treat: string) =>
  AsyncStorage.setItem(TREAT_KEY, treat);

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
