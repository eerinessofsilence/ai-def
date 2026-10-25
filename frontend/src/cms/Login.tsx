import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "./session";
import { ConnectionState, ErrorMessage } from "./ui";

export default function Login() {
  const { session, loading, error: connectionError, reload, signIn } = useSession();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (loading || connectionError) return <ConnectionState error={connectionError} retry={() => { void reload(); }} />;
  if (session?.authenticated && session.sites.length) {
    const from: unknown = (location.state as { from?: unknown } | null)?.from;
    return <Navigate to={typeof from === "string" && /^\/(arms|ai-def)\//.test(from) ? from : `/${session.sites[0].id}/products`} replace />;
  }
  return <main className="cms-login"><div className="cms-login-card"><img className="cms-login-logo" src="/logo-ai-def.svg" alt="AI DEF" width="160" height="44" /><h1>Site management</h1><p className="cms-muted">Sign in with your work email.</p>
    <form onSubmit={(event) => {
      event.preventDefault(); setBusy(true); setError("");
      void signIn(email, password).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : "Unable to sign in.")).finally(() => setBusy(false));
    }}><label className="cms-field"><span>Email</span><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="cms-field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <ErrorMessage message={error} />}<button className="cms-button cms-primary" disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in"}</button></form>
  </div></main>;
}
