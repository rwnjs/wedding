import fs from 'node:fs';
import path from 'node:path';

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}
function write(rel, value) {
  fs.writeFileSync(path.join(process.cwd(), rel), value);
}
function replaceOrThrow(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Patch target not found: ${label}`);
  return source.replace(search, replacement);
}
// Organizer UI actions: imports, mutate, quick toggles, delete.
{
  const rel = 'components/organizer/organizer-dashboard.tsx';
  let source = read(rel);
  source = replaceOrThrow(
    source,
    'import { ArrowLeft, Check, Copy, Download, Link2, Pencil, Plus, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";',
    'import { ArrowLeft, Check, Copy, Download, Link2, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, Users } from "lucide-react";',
    'dashboard icon import',
  );
  source = replaceOrThrow(
    source,
    'async function mutate(method: "POST" | "PATCH", values: Record<string, unknown>) {',
    'async function mutate(method: "POST" | "PATCH" | "DELETE", values: Record<string, unknown>) {',
    'dashboard mutate methods',
  );
  source = replaceOrThrow(
    source,
`  async function saveGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edit) return;
    setSaving(true); setActionError(""); setNotice(""); setFeedbackTarget("edit");
    try {
      await mutate("PATCH", { id: edit.id, fullName: edit.fullName, allowPlusOne: edit.allowPlusOne, active: edit.active });
      setNotice("Invitation updated."); setEdit(null);
      await loadResponses();
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : "We could not update this invitation.");
    } finally { setSaving(false); }
  }
`,
`  async function saveGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edit) return;
    setSaving(true); setActionError(""); setNotice(""); setFeedbackTarget("edit");
    try {
      await mutate("PATCH", { id: edit.id, fullName: edit.fullName, allowPlusOne: edit.allowPlusOne, active: edit.active });
      setNotice("Guest name updated."); setEdit(null);
      await loadResponses();
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : "We could not update this guest.");
    } finally { setSaving(false); }
  }

  async function quickUpdateGuest(guest: OrganizerGuest, changes: Partial<Pick<OrganizerGuest, "allowPlusOne" | "active">>) {
    if (changes.allowPlusOne === false && guest.response?.attendance === "attending" && guest.response.plusOne) {
      const confirmed = window.confirm("Remove the confirmed +1 for " + guest.fullName + "? Their RSVP will become attending alone.");
      if (!confirmed) return;
    }
    setSaving(true); setActionError(""); setNotice(""); setFeedbackTarget("edit");
    try {
      const nextPlusOne = changes.allowPlusOne ?? guest.allowPlusOne;
      const nextActive = changes.active ?? guest.active;
      await mutate("PATCH", { id: guest.id, fullName: guest.fullName, allowPlusOne: nextPlusOne, active: nextActive });
      if (changes.allowPlusOne !== undefined) setNotice(guest.fullName + ": +1 " + (nextPlusOne ? "allowed" : "removed") + ".");
      else setNotice(guest.fullName + ": invitation " + (nextActive ? "activated" : "deactivated") + ".");
      await loadResponses();
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : "We could not update this invitation.");
    } finally { setSaving(false); }
  }

  async function deleteGuestRow(guest: OrganizerGuest) {
    const confirmed = window.confirm("Delete " + guest.fullName + " from the guest list? This permanently removes the invitation and any saved RSVP for this guest.");
    if (!confirmed) return;
    setSaving(true); setActionError(""); setNotice(""); setFeedbackTarget("edit");
    try {
      await mutate("DELETE", { id: guest.id });
      if (edit?.id === guest.id) setEdit(null);
      setNotice(guest.fullName + " deleted from the guest list.");
      await loadResponses();
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : "We could not delete this guest.");
    } finally { setSaving(false); }
  }
`,
    'dashboard quick actions',
  );
  write(rel, source);
}

console.log('Guest-list row action logic enabled.');
