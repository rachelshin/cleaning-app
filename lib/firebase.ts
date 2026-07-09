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

let auth: Auth | null = null;
let db: Firestore | null = null;

if (firebaseReady) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
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
