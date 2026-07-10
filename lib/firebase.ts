import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, initializeAuth } from 'firebase/auth';
// @ts-ignore — exported by the react-native build of firebase/auth
import { getReactNativePersistence } from 'firebase/auth';
import {
  Firestore,
  initializeFirestore,
  persistentLocalCache,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { firebaseConfig } from './firebaseConfig';

// The app must keep working local-only until the config is pasted in.
export const firebaseReady = !!firebaseConfig.apiKey;

// Installed (home-screen) PWA: popups can't hand control back to the app,
// so Google sign-in must use the redirect flow. Safari partitions storage
// per-origin, which breaks redirects through the default firebaseapp.com
// authDomain — so in standalone mode the app's own domain is the
// authDomain, with netlify.toml proxying /__/auth/* to Firebase.
export const isStandalonePWA =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  ((window.navigator as any).standalone === true ||
    (window.matchMedia?.('(display-mode: standalone)').matches ?? false));

let auth: Auth | null = null;
let db: Firestore | null = null;

if (firebaseReady) {
  const config = isStandalonePWA
    ? { ...firebaseConfig, authDomain: window.location.host }
    : firebaseConfig;
  const app = getApps().length ? getApp() : initializeApp(config);
  auth =
    Platform.OS === 'web'
      ? getAuth(app)
      : initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage),
        });
  db = initializeFirestore(
    app,
    Platform.OS === 'web' ? { localCache: persistentLocalCache() } : {}
  );
}

export { auth, db };
