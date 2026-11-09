import fs from 'node:fs';
import path from 'node:path';

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}
function write(rel, value) {
  fs.writeFileSync(path.join(process.cwd(), rel), value);
}

// Organizer styles: compact row controls on desktop, full-width touch controls on mobile.
{
  const rel = 'components/organizer/organizer.module.css';
  let source = read(rel);
  source += `

/* Simplified guest-list management controls. */
.rowActions { display: flex; flex-wrap: wrap; gap: 7px; min-width: 210px; }
.quickToggle, .deleteButton { appearance: none; min-height: 34px; border-radius: 4px; padding: 7px 10px; font: 600 11px/1.2 Arial, Helvetica, sans-serif; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 5px; }
.quickToggle { border: 1px solid #cfd5d8; background: #fffefa; color: #526774; }
.quickToggleOn { border-color: #8ca4b5; background: #eaf1f5; color: #183d56; }
.quickToggleOff { border-color: #d4c8b0; background: #f6f0e4; color: #735f3e; }
.deleteButton { border: 1px solid #d9b5ad; background: #fff6f2; color: #8b3f35; }
.quickToggle:hover, .editButton:hover { border-color: #aa8542; }
.deleteButton:hover { border-color: #b86c5d; background: #ffebe5; }
.quickToggle:disabled, .deleteButton:disabled { cursor: not-allowed; opacity: .55; }
.editOverlay { position: fixed; inset: 0; z-index: 120; background: rgba(16, 43, 65, .38); display: grid; place-items: center; padding: 20px; }
.editDialog { width: min(520px, 100%); max-height: calc(100vh - 40px); overflow: auto; background: #fffdf8; border: 1px solid #cbb98e; border-radius: 8px; box-shadow: 0 24px 70px rgba(16, 43, 65, .22); padding: 24px; }
.editDialogHeader { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
.editDialogHeader h3 { margin: 0; font: 30px/1.15 Georgia, "Times New Roman", serif; color: #102b41; }
.dialogClose { border: 0; background: transparent; color: #60737f; font-size: 30px; line-height: 1; padding: 0 4px; cursor: pointer; }
.dialogClose:hover { color: #102b41; }
@media (max-width: 760px) {
  .rowActions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); min-width: 0; width: 100%; gap: 8px; }
  .rowActions > button { width: 100%; min-height: 40px; }
  .editDialog { padding: 20px 16px; }
  .editDialogHeader h3 { font-size: 27px; }
}
`;
  write(rel, source);
}

console.log('Guest-list management styles enabled.');
