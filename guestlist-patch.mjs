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

// Blob storage: support permanent guest deletion and stale name-index cleanup.
{
  const rel = 'lib/blob-rsvp-store.ts';
  let source = read(rel);
  source = replaceOrThrow(
    source,
    'import { get, list, put } from "@vercel/blob";',
    'import { del, get, list, put } from "@vercel/blob";',
    'blob import',
  );
  source = replaceOrThrow(
    source,
`export async function saveGuest(guest: StoredGuest): Promise<void> {
  await writeJson(guestPath(guest.id), guest);
  await writeJson(namePath(guest.nameKey), { id: guest.id, nameKey: guest.nameKey } satisfies NameIndex);
}

export async function getResponse`,
`export async function saveGuest(guest: StoredGuest): Promise<void> {
  await writeJson(guestPath(guest.id), guest);
  await writeJson(namePath(guest.nameKey), { id: guest.id, nameKey: guest.nameKey } satisfies NameIndex);
}

export async function deleteNameIndex(nameKey: string): Promise<void> {
  await del(namePath(nameKey));
}

export async function deleteGuestRecord(guest: StoredGuest): Promise<void> {
  await del([guestPath(guest.id), n¶»§q«^