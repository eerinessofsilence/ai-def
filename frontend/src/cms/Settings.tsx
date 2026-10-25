import Select from "../../components/ui/select";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, APIError } from "./api";
import { useSession } from "./session";
import { ErrorMessage, Loading, Modal } from "./ui";

type Member = { id: number; name: string; email: string; role: string };
type Problem = { message: string; fields: Record<string, string>; area: "account" | "access" };
const roles: Record<string, string> = { editor: "Editor", publisher: "Publisher", manager: "Site manager" };
const passwordHelp = "Use at least 8 characters. Avoid common passwords, personal details and passwords made only of numbers.";

export default function Settings() {
  const { site = "arms" } = useParams();
  return <WorkspaceSettings key={site} site={site} />;
}

function WorkspaceSettings({ site }: { site: string }) {
  const { session } = useSession();
  const manager = session?.sites.find((item) => item.id === site)?.role === "manager";
  const [members, setMembers] = useState<Member[]>([]);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState<"" | "account" | "access">("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [pendingRole, setPendingRole] = useState<{ member: Member; role: string } | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [role, setRole] = useState("editor");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(manager);
  const [accessNotice, setAccessNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const domain = site === "arms" ? "arms.ai-def.com" : "ai-def.com";

  function report(failure: unknown, area: Problem["area"]) {
    setProblem({ area, message: failure instanceof Error ? failure.message : "Unable to complete this action. Please try again.", fields: failure instanceof APIError ? Object.fromEntries(Object.entries(failure.fields).map(([key, message]) => [key === "first_name" ? "name" : key, message])) : {} });
  }
  function clearField(key: string) {
    setSaved(false);
    setProblem((previous) => {
      if (!previous) return null;
      const fields = Object.fromEntries(Object.entries(previous.fields).filter(([field]) => field !== key));
      return Object.keys(fields).length ? { ...previous, fields } : null;
    });
  }
  function attributes(key: string) {
    return { id: `settings-${key}`, "aria-label": ({ current_password: "Current password", new_password: "New password", password: "Initial password", email: "Email", name: "Name", role: "Role" } as Record<string, string>)[key], "aria-invalid": Boolean(problem?.fields[key]), "aria-describedby": problem?.fields[key] ? `settings-${key}-error` : undefined };
  }
  function fieldError(key: string) {
    return problem?.fields[key] && <small className="cms-field-error" id={`settings-${key}-error`}>{problem.fields[key]}</small>;
  }
  const notice = problem && <ErrorMessage message={problem.message} fields={problem.fields} />;
  useEffect(() => {
    if (!manager) return;
    const abort = new AbortController();
    setLoadingMembers(true);
    void api<{ items: Member[] }>(`${site}/members/`, { signal: abort.signal })
      .then((result) => { if (!abort.signal.aborted) setMembers(result.items); })
      .catch((failure: unknown) => { if (!abort.signal.aborted) report(failure, "access"); })
      .finally(() => { if (!abort.signal.aborted) setLoadingMembers(false); });
    return () => abort.abort();
  }, [site, manager, attempt]);

  async function updateMember(method: string, values: Record<string, unknown>) {
    setBusy("access"); setProblem(null); setAccessNotice("");
    try {
      const result = await api<{ items: Member[] }>(`${site}/members/`, { method, body: JSON.stringify(values) });
      setMembers(result.items); setAdding(false); setRemoving(null); setPendingRole(null);
      setInitialPassword(""); setEmail(""); setName(""); setAccessNotice(`Access to ${domain} updated.`);
    } catch (failure) { report(failure, "access"); }
    finally { setBusy(""); }
  }

  return <section className="cms-page">
    <header className="cms-page-heading"><div><h1>Settings</h1><p className="cms-muted">Account and access to {domain}.</p></div></header>
    {accessNotice && <p className="cms-notice" role="status">{accessNotice}</p>}
    <div className="cms-settings-grid">
      <form className="cms-panel" onSubmit={(event) => {
        event.preventDefault(); setBusy("account"); setSaved(false); setProblem(null);
        void api(`${site}/password/`, { method: "POST", body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) })
          .then(() => { setCurrentPassword(""); setNewPassword(""); setSaved(true); })
          .catch((failure: unknown) => report(failure, "account")).finally(() => setBusy(""));
      }}><fieldset className="cms-editor-fields" disabled={Boolean(busy)}>
        <h2>Account</h2><p className="cms-muted">Change your account password.</p>
        <label className="cms-field"><span>Current password</span><input {...attributes("current_password")} type="password" autoComplete="current-password" required maxLength={1024} value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); clearField("current_password"); }} />{fieldError("current_password")}</label>
        <label className="cms-field"><span>New password</span><input {...attributes("new_password")} aria-describedby={["settings-password-help", attributes("new_password")["aria-describedby"]].filter(Boolean).join(" ")} type="password" autoComplete="new-password" required minLength={8} maxLength={1024} value={newPassword} onChange={(event) => { setNewPassword(event.target.value); clearField("new_password"); }} /><small id="settings-password-help">{passwordHelp}</small>{fieldError("new_password")}</label>
        {problem?.area === "account" && notice}
        <button className="cms-button cms-primary cms-form-submit" type="submit">{busy === "account" ? "Changing password…" : "Change password"}</button>
        {saved && <p className="cms-success" role="status">Password changed.</p>}
      </fieldset></form>
      {manager && <section className="cms-panel">
        <div className="cms-panel-heading"><h2>Access to {domain}</h2><button className="cms-button" disabled={Boolean(busy)} onClick={() => { setProblem(null); setAdding(true); }}>Add team member</button></div>
        <p className="cms-muted">Editors prepare drafts. Publishers update the website. Managers also manage team access.</p>
        {problem?.area === "access" && !adding && !removing && !pendingRole && <>{notice}<button className="cms-button" onClick={() => setAttempt((value) => value + 1)}>Reload team members</button></>}
        {loadingMembers && <Loading label="Loading team members…" />}
        <div className="cms-members">{members.map((member) => <div key={member.id}>
          <div><strong>{member.name}</strong><small>{member.email}</small></div>
          <Select aria-label={`Role: ${member.name}`} value={member.role} disabled={Boolean(busy)} onValueChange={(selectedValue) => { setProblem(null); setPendingRole({ member, role: selectedValue }); }}>{Object.entries(roles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
          <button className="cms-button cms-danger" disabled={Boolean(busy)} onClick={() => { setRemoving(member); setProblem(null); }}>Remove access</button>
        </div>)}{!loadingMembers && problem?.area !== "access" && !members.length && <p className="cms-muted">No team members have been granted access yet, apart from administrators.</p>}</div>
      </section>}
    </div>
    <Modal preventDismiss={Boolean(busy)} open={adding} onClose={() => { setAdding(false); setInitialPassword(""); }} title="Add team member" description="Grant access to this site. Existing accounts keep their password. For a new account, set an initial password and share it with the person yourself.">
      <form onSubmit={(event) => { event.preventDefault(); void updateMember("POST", { email, name, password: initialPassword, role }); }}><fieldset className="cms-editor-fields" disabled={Boolean(busy)}>
        <label className="cms-field"><span>Email <small className="cms-required">Required</small></span><input {...attributes("email")} type="email" autoComplete="off" required maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); clearField("email"); }} />{fieldError("email")}</label>
        <label className="cms-field"><span>Name</span><input {...attributes("name")} value={name} maxLength={30} onChange={(event) => { setName(event.target.value); clearField("name"); }} />{name.length >= 27 && <small className="cms-limit">{name.length}/30 characters</small>}{fieldError("name")}</label>
        <label className="cms-field"><span>Initial password</span><input {...attributes("password")} type="password" autoComplete="new-password" maxLength={1024} value={initialPassword} onChange={(event) => { setInitialPassword(event.target.value); clearField("password"); }} /><small>Required only for a new account. {passwordHelp}</small>{fieldError("password")}</label>
        <label className="cms-field"><span>Role</span><Select {...attributes("role")} value={role} onValueChange={(value) => { setRole(value); clearField("role"); }}>{Object.entries(roles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>{fieldError("role")}</label>
        {problem?.area === "access" && notice}
        <footer className="cms-dialog-actions"><button type="button" className="cms-button" onClick={() => { setAdding(false); setInitialPassword(""); }}>Cancel</button><button type="submit" className="cms-button cms-primary">{busy === "access" ? "Adding…" : "Add team member"}</button></footer>
      </fieldset></form>
    </Modal>
    <Modal preventDismiss={Boolean(busy)} open={removing !== null} onClose={() => setRemoving(null)} title={`Remove access for ${removing?.name || "team member"}?`} description="The account will be retained. Access to other sites will stay unchanged.">
      {problem?.area === "access" && notice}<footer><button className="cms-button" disabled={Boolean(busy)} onClick={() => setRemoving(null)}>Cancel</button><button className="cms-button cms-danger" disabled={Boolean(busy)} onClick={() => { if (removing) void updateMember("DELETE", { user_id: removing.id }); }}>{busy ? "Removing…" : "Remove access"}</button></footer>
    </Modal>
    <Modal preventDismiss={Boolean(busy)} open={pendingRole !== null} onClose={() => setPendingRole(null)} title="Change team member role?" description={`${domain} · ${pendingRole?.member.name || ""}. New role: ${roles[pendingRole?.role || ""] || ""}. Access to other sites will stay unchanged.`}>
      {problem?.area === "access" && notice}<footer><button className="cms-button" disabled={Boolean(busy)} onClick={() => setPendingRole(null)}>Cancel</button><button className="cms-button cms-primary" disabled={Boolean(busy)} onClick={() => { if (pendingRole) void updateMember("PUT", { user_id: pendingRole.member.id, role: pendingRole.role }); }}>{busy ? "Saving…" : "Change role"}</button></footer>
    </Modal>
  </section>;
}
