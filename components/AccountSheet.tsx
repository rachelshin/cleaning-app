import { LinearGradient } from 'expo-linear-gradient';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getRedirectResult,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  linkWithRedirect,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from 'firebase/auth';
import { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, firebaseReady, isStandalonePWA } from '../lib/firebase';
import { useIosPWAKeyboard } from '../lib/useIosPWAKeyboard';

const FRIENDLY: Record<string, string> = {
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/missing-password': 'Enter a password.',
  'auth/weak-password': 'Password needs at least 6 characters.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'No account with that email — try Create account.',
  'auth/email-already-in-use': 'That email already has an account — try Sign in.',
  'auth/popup-closed-by-user': 'Sign-in window was closed.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window — try again.',
  'auth/unauthorized-domain':
    'This domain isn’t authorized for sign-in — add it in the Firebase console.',
};

// Signing into a Google account that already exists: reuse the credential
// Firebase attached to the link error. Opening a second popup here would be
// blocked (it's no longer inside the user's tap gesture).
async function signInToExisting(e: any) {
  const cred = GoogleAuthProvider.credentialFromError(e);
  if (!cred) throw e;
  await signInWithCredential(auth!, cred);
}

export default function AccountSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const iosPWAKeyboard = useIosPWAKeyboard();

  const [user, setUser] = useState<User | null>(null);
  // Derived from isAnonymous but tracked as state: linking does not
  // re-fire onAuthStateChanged, so we update it explicitly after linking.
  const [isGuest, setIsGuest] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsGuest(u?.isAnonymous ?? true);
    });
  }, []);

  // Pick up the result of a redirect sign-in (standalone PWA flow) after
  // the app reloads on return from Google.
  useEffect(() => {
    if (!auth || Platform.OS !== 'web') return;
    getRedirectResult(auth)
      .then((res) => {
        if (res) refresh();
      })
      .catch(async (e: any) => {
        try {
          if (e?.code === 'auth/credential-already-in-use') {
            await signInToExisting(e);
            refresh();
          } else {
            fail(e);
          }
        } catch (e2) {
          fail(e2);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A hung popup promise must never leave the buttons permanently
  // disabled — reopening the sheet always starts clean.
  useEffect(() => {
    if (visible) {
      setBusy(false);
      setError('');
    }
  }, [visible]);

  const fail = (e: any) =>
    setError(FRIENDLY[e?.code] ?? 'Something went wrong — try again.');

  const refresh = () => {
    setUser(auth!.currentUser);
    setIsGuest(auth!.currentUser?.isAnonymous ?? true);
    setError('');
    setEmail('');
    setPassword('');
  };

  const withBusy = (fn: () => Promise<void>) => async () => {
    if (busy || !auth) return;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = withBusy(async () => {
    const provider = new GoogleAuthProvider();
    const current = auth!.currentUser;

    if (isStandalonePWA) {
      // Installed PWAs can't use popups — navigate away to Google and pick
      // the result up in getRedirectResult when the app reloads.
      if (current?.isAnonymous) {
        await linkWithRedirect(current, provider);
      } else {
        await signInWithRedirect(auth!, provider);
      }
      return;
    }

    try {
      if (current?.isAnonymous) {
        // Keeps the same uid, so all guest data carries over.
        await linkWithPopup(current, provider);
      } else {
        await signInWithPopup(auth!, provider);
      }
    } catch (e: any) {
      // Google account already has its own account — sign into it instead.
      if (e?.code === 'auth/credential-already-in-use') {
        await signInToExisting(e);
      } else {
        throw e;
      }
    }
    refresh();
  });

  const emailCreate = withBusy(async () => {
    const current = auth!.currentUser;
    if (current?.isAnonymous) {
      const cred = EmailAuthProvider.credential(email.trim(), password);
      await linkWithCredential(current, cred);
    } else {
      await createUserWithEmailAndPassword(auth!, email.trim(), password);
    }
    refresh();
  });

  const emailSignIn = withBusy(async () => {
    await signInWithEmailAndPassword(auth!, email.trim(), password);
    refresh();
  });

  const doSignOut = withBusy(async () => {
    await signOut(auth!); // sync auto-starts a fresh guest session
    refresh();
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdropBottom}>
        <Pressable style={s.backdropFill} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 24 + iosPWAKeyboard }]}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>Your cozy corner</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={s.closeX}>✕</Text>
            </Pressable>
          </View>

          <Image
            source={require('../assets/mascot/bean-cozy.png')}
            style={s.mascot}
            resizeMode="contain"
          />

          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
            {!firebaseReady ? (
              <Text style={s.note}>
                Accounts aren’t set up yet — paste your Firebase config into
                lib/firebaseConfig.ts to enable sign-in and cloud sync.
              </Text>
            ) : !isGuest && user ? (
              <>
                <Text style={s.note}>
                  Signed in as{' '}
                  <Text style={s.noteStrong}>{user.email ?? 'your Google account'}</Text>
                  . Your beans sync to the cloud automatically 🌱
                </Text>
                <Pressable style={s.outlineBtn} onPress={doSignOut} disabled={busy}>
                  <Text style={s.outlineBtnText}>Sign out</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={s.note}>
                  You’re in guest mode — everything’s saved snug on this
                  device. Sign in to keep your beans safe everywhere.
                </Text>

                {Platform.OS === 'web' && (
                  <Pressable onPress={googleSignIn} disabled={busy} style={s.googleBtnWrap}>
                    <View style={s.googleBtn}>
                      <Text style={s.googleBtnText}>Continue with Google</Text>
                    </View>
                  </Pressable>
                )}

                <Text style={s.inputLabel}>Email</Text>
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  placeholder="you@example.com"
                  placeholderTextColor="#C9BBA3"
                />
                <Text style={s.inputLabel}>Password</Text>
                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  placeholder="••••••••"
                  placeholderTextColor="#C9BBA3"
                />
                {!!error && <Text style={s.errorText}>{error}</Text>}
                <Pressable onPress={emailCreate} disabled={busy}>
                  <LinearGradient
                    colors={['#9BC178', '#6F9E4C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.saveBtn}
                  >
                    <Text style={s.saveBtnText}>Create account</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable style={s.outlineBtn} onPress={emailSignIn} disabled={busy}>
                  <Text style={s.outlineBtnText}>Sign in to an existing account</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdropBottom: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(74,59,44,0.5)' },
  backdropFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: '#FCF6EA',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 18,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sheetTitle: { fontSize: 20, fontFamily: 'Nunito_800ExtraBold', color: '#4A3B2C' },
  closeX: { fontSize: 18, color: '#8A7A68', fontFamily: 'Nunito_800ExtraBold' },

  mascot: { width: 128, height: 128, alignSelf: 'center', marginBottom: 4, borderRadius: 24 },

  note: {
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    color: '#8A7A68',
    lineHeight: 20,
    marginBottom: 16,
    backgroundColor: '#F1E9D8',
    borderRadius: 18,
    padding: 14,
  },
  noteStrong: { color: '#4A3B2C', fontFamily: 'Nunito_700Bold' },

  googleBtnWrap: { marginBottom: 16 },
  googleBtn: {
    backgroundColor: '#4E7E9B',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  googleBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Nunito_800ExtraBold' },

  inputLabel: { fontSize: 13, fontFamily: 'Nunito_700Bold', color: '#8A7A68', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E6D9C4',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: 'Nunito_600SemiBold',
    color: '#4A3B2C',
    marginBottom: 16,
    minHeight: 48,
  },
  errorText: {
    color: '#C4645A',
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  saveBtn: {
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#6F9E4C',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Nunito_800ExtraBold' },
  outlineBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  outlineBtnText: { color: '#5E8A44', fontSize: 15, fontFamily: 'Nunito_700Bold' },
});
