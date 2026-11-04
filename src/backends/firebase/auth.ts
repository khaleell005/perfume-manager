import { EmailAuthProvider, onIdTokenChanged, reauthenticateWithCredential, signInWithEmailAndPassword, signOut as firebaseSignOut, updatePassword, updateProfile } from 'firebase/auth';
import { auth } from '../../firebase';
import type { User as FirebaseUser } from 'firebase/auth';

export interface User { id: string; email: string; displayName: string }
export interface Session { user: User | null; setupRequired: boolean }
const session = (user: FirebaseUser | null): Session => ({ user: user ? { id: user.uid, email: user.email || '', displayName: user.displayName || 'Business admin' } : null, setupRequired: false });
const profileListeners = new Set<(session: Session) => void>();
export function onSessionChanged(callback: (session: Session) => void, onError: () => void) {
  let active = true, version = 0;
  profileListeners.add(callback);
  const unsubscribe = onIdTokenChanged(auth, async user => {
    const current = ++version;
    try {
      const admin = user && (await user.getIdTokenResult()).claims.admin === true;
      if (active && current === version) callback(session(admin ? user : null));
    } catch { if (active && current === version) onError(); }
  }, () => { if (active) onError(); });
  return () => { active = false; profileListeners.delete(callback); unsubscribe(); };
}
export async function signIn(email: string, password: string) {
  try {
    const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
    if ((await user.getIdTokenResult(true)).claims.admin !== true) {
      await firebaseSignOut(auth);
      throw new Error('This account does not have admin access.');
    }
    return session(user);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password', 'auth/invalid-email'].includes(code || '')) throw new Error('Incorrect email or password.');
    if (code === 'auth/too-many-requests') throw new Error('Too many sign-in attempts. Please try again later.');
    if (code === 'auth/network-request-failed') throw new Error('Unable to connect. Check your internet connection.');
    throw error;
  }
}
// Public owner registration stays disabled; only the server-side setup grants admin access.
export async function createOwner(_email: string, _password: string): Promise<Session> { throw new Error('Ask the business admin for access.'); }
export async function signOut() { await firebaseSignOut(auth); return session(null); }
export async function updateProfileName(name: string) {
  name = name.trim();
  if (!name || name.length > 120) throw new Error('Enter your full name (up to 120 characters).');
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in before updating your name.');
  await updateProfile(user, { displayName: name });
  const updated = session(user);
  profileListeners.forEach(listener => listener(updated));
  return updated;
}
export async function changePassword(currentPassword: string, password: string) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Sign in before changing your password.');
  try { await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword)); }
  catch { throw new Error('Your current password is incorrect or could not be verified.'); }
  await updatePassword(user, password);
}
