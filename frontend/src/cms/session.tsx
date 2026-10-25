import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Context as ReactContext, ReactNode } from "react";
import { api, AUTH_REQUIRED_EVENT, SESSION_RESTORED_EVENT } from "./api";
import type { Session } from "./api";
import { ErrorMessage, Modal } from "./ui";

type SessionContext = { session: Session | null; loading: boolean; error: string; reload: () => Promise<void>; signIn: (email: string, password: string) => Promise<void>; signOut: () => Promise<void>; beforeSignOut: (callback: () => Promise<unknown>) => () => void };
// Keep provider identity when Vite refreshes shared editor components.
const Context: ReactContext<SessionContext | null> = import.meta.hot?.data.cmsSessionContext ?? createContext<SessionContext | null>(null);
if (import.meta.hot) import.meta.hot.data.cmsSessionContext = Context;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reauth, setReauth] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  useEffect(() => {
    const expired = () => { if (!needsSignIn) setReauth(true); setNeedsSignIn(true); setAuthError(""); };
    const restored = () => { setNeedsSignIn(false); setReauth(false); setPassword(""); };
    window.addEventListener(AUTH_REQUIRED_EVENT, expired);
    window.addEventListener(SESSION_RESTORED_EVENT, restored);
    return () => { window.removeEventListener(AUTH_REQUIRED_EVENT, expired); window.removeEventListener(SESSION_RESTORED_EVENT, restored); };
  }, [needsSignIn]);
  const signOutGuard = useRef<(() => Promise<unknown>) | null>(null);
  const beforeSignOut = useCallback((callback: () => Promise<unknown>) => {
    signOutGuard.current = callback;
    return () => { if (signOutGuard.current === callback) signOutGuard.current = null; };
  }, []);
  async function reload() {
    setLoading(true);
    setError("");
    try { setSession(await api<Session>("session/")); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to connect to CMS."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, []);
  async function signIn(email: string, password: string) {
    setSession(await api<Session>("session/", { method: "POST", body: JSON.stringify({ email, password }) }));
  }
  async function signOut() {
    await signOutGuard.current?.();
    setSession(await api<Session>("session/", { method: "DELETE" }));
  }
  return <Context.Provider value={{ session, loading, error, reload, signIn, signOut, beforeSignOut }}>{children}{needsSignIn && !reauth && <div className="cms-session-notice" role="alert"><span>Session expired. Your open form has been kept.</span><button type="button" className="cms-button" onClick={() => setReauth(true)}>Sign in</button></div>}<Modal open={reauth} onClose={() => { setReauth(false); setPassword(""); }} preventDismiss={signingIn} title="Sign in to continue" description="Your session expired. Your open form and unsaved changes have been kept. Sign in here to continue without reloading."><form onSubmit={(event) => {
    event.preventDefault(); setSigningIn(true); setAuthError("");
    void signIn(email, password).then(() => { setPassword(""); setReauth(false); }).catch((failure: unknown) => setAuthError(failure instanceof Error ? failure.message : "Unable to sign in.")).finally(() => setSigningIn(false));
  }}><fieldset className="cms-editor-fields" disabled={signingIn}><label className="cms-field"><span>Email</span><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="cms-field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{authError && <ErrorMessage message={authError} />}<footer className="cms-dialog-actions"><button type="button" className="cms-button" onClick={() => { setReauth(false); setPassword(""); }}>Keep editing</button><button type="submit" className="cms-button cms-primary">{signingIn ? "Signing in…" : "Sign in"}</button></footer></fieldset></form></Modal></Context.Provider>;
}

// The hook must share the provider's preserved context during hot replacement.
// eslint-disable-next-line react-refresh/only-export-components
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error("CMS session provider is missing");
  return value;
}
