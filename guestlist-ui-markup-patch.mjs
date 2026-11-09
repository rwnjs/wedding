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
// Organizer UI markup: edit-name modal and direct row controls.
{
  const rel = 'components/organizer/organizer-dashboard.tsx';
  let source = read(rel);
  source = replaceOrThrow(
    source,
`        {edit && <form className={styles.editForm} onSubmit={saveGuest}>
          <h3 tabIndex={-1} ref={editHeading}>Edit invitation</h3>
          <div className={styles.nameField}><label htmlFor="edit-guest-name">Full name</label><input id="edit-guest-name" required minLength={2} maxLength={120} value={edit.fullName} disabled={saving} onChange={(event) => setEdit({ ...edit, fullName: event.target.value })} /></div>
          <div className={styles.editOptions}>
            <label className={styles.checkLabel}><input type="checkbox" checked={edit.allowPlusOne} disabled={saving || edit.confirmedPlusOne} onChange={(event) => setEdit({ ...edit, allowPlusOne: event.target.checked })} /> Allow +1</label>
            <label className={styles.checkLabel}><input type="checkbox" checked={edit.active} disabled={saving} onChange={(event) => setEdit({ ...edit, active: event.target.checked })} /> Active invitation</label>
          </div>
          {edit.confirmedPlusOne && <p className={styles.formNote}>This guest has confirmed a +1. They must update to attending alone or not attending before the +1 allowance can be removed.</p>}
          <p className={styles.formNote}>Deactivating an invitation stops it from accepting replies and excludes it from the totals. Existing replies are preserved.</p>
          <div className={styles.formActions}><button className={styles.actionButton} type="submit" disabled={controlsDisabled}>{saving ? "Saving…" : "Save invitation"}</button><button type="button" className={styles.secondaryButton} onClick={() => setEdit(null)} disabled={saving}>Cancel</button></div>
        </form>}
`,
`        {edit && <div className={styles.editOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEdit(null); }}>
          <form className={styles.editDialog} onSubmit={saveGuest} role="dialog" aria-modal="true" aria-labelledby="edit-guest-heading">
            <div className={styles.editDialogHeader}><div><p className={styles.eyebrow}>Guest details</p><h3 id="edit-guest-heading" tabIndex={-1} ref={editHeading}>Edit guest name</h3></div><button type="button" className={styles.dialogClose} aria-label="Close edit guest" onClick={() => setEdit(null)} disabled={saving}>×</button></div>
            <div className={styles.nameField}><label htmlFor="edit-guest-name">Full name</label><input id="edit-guest-name" required minLength={2} maxLength={120} value={edit.fullName} disabled={saving} onChange={(event) => setEdit({ ...edit, fullName: event.target.value })} /></div>
            <p className={styles.formNote}>Use the +1 and Active buttons directly on the guest row for those changes.</p>
            <div className={styles.formActions}><button className={styles.actionButton} type="submit" disabled={controlsDisabled}>{saving ? "Saving…" : "Save name"}</button><button type="button" className={styles.secondaryButton} onClick={() => setEdit(null)} disabled={saving}>Cancel</button></div>
          </form>
        </div>}
`,
    'dashboard edit dialog',
  );
  source = replaceOrThrow(
    source,
`            <td data-label="Invitation"><button type="button" className={styles.editButton} onClick={() => editGuest(guest)} disabled={saving}><Pencil size={14} aria-hidden="true" /> Edit<span className={styles.srOnly}> invitation for {guest.fullName}</span></button></td>`,
`            <td data-label="Manage invitation"><div className={styles.rowActions}>
              <button type="button" className={\`${'${styles.quickToggle}'} ${'${guest.allowPlusOne ? styles.quickToggleOn : ""}'}\`} aria-pressed={guest.allowPlusOne} onClick={() => void quickUpdateGuest(guest, { allowPlusOne: !guest.allowPlusOne })} disabled={saving}><Plus size={14} aria-hidden="true" /> +1 {guest.allowPlusOne ? "On" : "Off"}</button>
              <button type="button" className={\`${'${styles.quickToggle}'} ${'${guest.active ? styles.quickToggleOn : styles.quickToggleOff}'}\`} aria-pressed={guest.active} onClick={() => void quickUpdateGuest(guest, { active: !guest.active })} disabled={saving}><Check size={14} aria-hidden="true" /> {guest.active ? "Active" : "Inactive"}</button>
              <button type="button" className={styles.editButton} onClick={() => editGuest(guest)} disabled={saving}><Pencil size={14} aria-hidden="true" /> Edit name<span className={styles.srOnly}> for {guest.fullName}</span></button>
              <button type="button" className={styles.deleteButton} onClick={() => void deleteGuestRow(guest)} disabled={saving}><Trash2 size={14} aria-hidden="true" /> Delete<span className={styles.srOnly}> {guest.fullName}</span></button>
            </div></td>`,
    'dashboard row actions',
  );
  write(rel, source);
}

console.log('Guest-list row action markup enabled.');
