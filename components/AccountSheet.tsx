import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { useEffect, useState } from 'react';
import {
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
import { auth, firebaseReady } from '../lib/firebase';
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
};

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
        await signInWithPopup(auth!, provider);
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
            <Text style={s.sheetTitle}>Account</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={s.closeX}>✕</Text>
            </Pressable>
          </View>

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
                  . Your data syncs to the cloud automatically.
                </Text>
                <Pressable style={s.outlineBtn} onPress={doSignOut} disabled={busy}>
                  <Text style={s.outlineBtnText}>Sign out</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={s.note}>
                  You’re in guest mode — everything is saved and synced, but
                  it’s tied to this device. Add a sign-in to keep your data
                  safe and use it on other devices.
                </Text>

                {Platform.OS === 'web' && (
                  <Pressable style={s.googleBtn} onPress={googleSignIn} disabled={busy}>
                    <Text style={s.googleBtnText}>Continue with Google</Text>
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
                />
                <Text style={s.inputLabel}>Password</Text>
                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                />
                {!!error && <Text style={s.errorText}>{error}</Text>}
                <Pressable style={s.saveBtn} onPress={emailCreate} disabled={busy}>
                  <Text style={s.saveBtnText}>Create account</Text>
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
  backdropBottom: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(30,25,20,0.55)' },
  backdropFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    maxHeight: '85%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 20, fontFamily: 'Nunito_800ExtraBold', color: '#33302E' },
  closeX: { fontSize: 20, color: '#8A8480', fontFamily: 'Nunito_700Bold' },

  note: {
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    color: '#8A8480',
    lineHeight: 20,
    marginBottom: 16,
  },
  noteStrong: { color: '#33302E', fontFamily: 'Nunito_700Bold' },

  googleBtn: {
    backgroundColor: '#4361EE',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  googleBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Nunito_800ExtraBold' },

  inputLabel: { fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#8A8480', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5DFD5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Nunito_600SemiBold',
    color: '#33302E',
    marginBottom: 16,
    minHeight: 48,
  },
  errorText: {
    color: '#E23D5B',
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: '#00A896',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'Nunito_800ExtraBold' },
  outlineBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  outlineBtnText: { color: '#00A896', fontSize: 15, fontFamily: 'Nunito_700Bold' },
});
