import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, firebaseReady } from './firebase';
import {
  applyRemoteData,
  collectAllData,
  getLocalUpdatedAt,
  resetLocalUpdatedAt,
  setOnLocalChange,
} from './storage';

// Offline-first sync: AsyncStorage is the source of truth the UI touches;
// this module mirrors it to users/{uid} in Firestore in the background.
// Firebase writes are never in the path of a user action.

const SYNC_UID_KEY = 'spinclean:syncUid';

let uid: string | null = null;
let unsubSnapshot: (() => void) | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

export function startSync() {
  if (started || !firebaseReady || !auth || !db) return;
  started = true;

  setOnLocalChange(schedulePush);

  onAuthStateChanged(auth, async (user) => {
    unsubSnapshot?.();
    unsubSnapshot = null;
    uid = user?.uid ?? null;

    if (!user) {
      // Guests are real Firebase users from day one.
      signInAnonymously(auth!).catch(() => {});
      return;
    }

    // Switching to a different account on this device: whatever that
    // account has in the cloud must win over local leftovers.
    const lastUid = await AsyncStorage.getItem(SYNC_UID_KEY);
    if (lastUid && lastUid !== user.uid) await resetLocalUpdatedAt();
    await AsyncStorage.setItem(SYNC_UID_KEY, user.uid);

    unsubSnapshot = onSnapshot(
      doc(db!, 'users', user.uid),
      async (snap) => {
        const remote = snap.data();
        const localAt = await getLocalUpdatedAt();
        const remoteAt = (remote?.updatedAt as number) ?? 0;
        if (remote && remoteAt > localAt) {
          await applyRemoteData(remote);
        } else if (!snap.metadata.hasPendingWrites && remoteAt < localAt) {
          // Cloud is behind (or the doc doesn't exist yet) — push local.
          schedulePush();
        }
      },
      () => {} // ignore transient errors; next snapshot retries
    );
  });
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 1500);
}

async function push() {
  if (!uid || !db) return;
  try {
    const data = await collectAllData();
    if (!data.updatedAt) return; // nothing user-authored yet
    await setDoc(doc(db, 'users', uid), data, { merge: true });
  } catch {
    // Offline or rules hiccup — AsyncStorage still has everything; the
    // next local edit or snapshot re-schedules a push.
  }
}
