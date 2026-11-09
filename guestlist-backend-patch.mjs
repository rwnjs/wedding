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
  await del([guestPath(guest.id), namePath(guest.nameKey), responsePath(guest.id)]);
}

export async function getResponse`,
    'blob delete helpers',
  );
  write(rel, source);
}

// Roster: organizer can turn off a confirmed +1 and can permanently delete a guest.
{
  const rel = 'lib/rsvp-roster.ts';
  let source = read(rel);
  source = replaceOrThrow(
    source,
`import {
  findGuestByNameKey,
  getGuest,
  getResponse,
  saveGuest,
  saveResponse,
  type StoredResponse,
} from "./blob-rsvp-store";`,
`import {
  deleteGuestRecord,
  deleteNameIndex,
  findGuestByNameKey,
  getGuest,
  getResponse,
  saveGuest,
  saveResponse,
  type StoredResponse,
} from "./blob-rsvp-store";`,
    'roster imports',
  );
  const start = source.indexOf('export async function updateGuest');
  if (start < 0) throw new Error('Patch target not found: updateGuest');
  source = source.slice(0, start) + `export async function updateGuest(input: Record<string, unknown>) {
  if (typeof input.id !== "string" || !input.id || typeof input.active !== "boolean" || typeof input.allowPlusOne !== "boolean") {
    throw new RsvpError(400, "Please check this invitation and try again.");
  }
  const fields = validateGuestEntry(input);
  const current = await getGuest(input.id);
  if (!current) throw new RsvpError(404, "This invitation could not be found. Refresh the guest list.");
  const duplicate = await findGuestByNameKey(fields.nameKey);
  if (duplicate && duplicate.id !== input.id) throw new RsvpError(409, "That name is already on the guest list. For guests with the same name, include a middle name or initial.");

  const now = Date.now();
  if (!fields.allowPlusOne) {
    const response = await getResponse(input.id);
    if (response?.attendance === "attending" && response.plusOne) {
      await saveResponse({ ...response, plusOne: false, companionName: "", updatedAt: now });
    }
  }
  if (current.nameKey !== fields.nameKey) await deleteNameIndex(current.nameKey);

  const invitationVersion = (!input.active || current.nameKey !== fields.nameKey) ? current.invitationVersion + 1 : current.invitationVersion;
  await saveGuest({
    ...current, fullName: fields.fullName, nameKey: fields.nameKey, allowPlusOne: fields.allowPlusOne,
    active: input.active, invitationVersion, updatedAt: now,
  });
  return { id: input.id };
}

export async function deleteGuest(input: Record<string, unknown>) {
  if (typeof input.id !== "string" || !input.id) throw new RsvpError(400, "Please choose a guest to delete.");
  const current = await getGuest(input.id);
  if (!current) throw new RsvpError(404, "This invitation could not be found. Refresh the guest list.");
  await deleteGuestRecord(current);
  return { id: current.id };
}
`;
  write(rel, source);
}

// API: add DELETE while keeping the same organizer/origin/CSRF protections.
{
  const rel = 'app/api/organizer/guests/route.ts';
  let source = read(rel);
  source = replaceOrThrow(
    source,
    'import { importGuests, updateGuest } from "@/lib/rsvp-roster";',
    'import { deleteGuest, importGuests, updateGuest } from "@/lib/rsvp-roster";',
    'guest route import',
  );
  source = replaceOrThrow(
    source,
    'function rejectedRequest(error: unknown, method: "POST" | "PATCH", stage: string): Response {',
    'function rejectedRequest(error: unknown, method: "POST" | "PATCH" | "DELETE", stage: string): Response {',
    'guest route method union',
  );
  source += `\nexport async function DELETE(request: Request) {
  let stage = "owner";
  try {
    await requireOrganizer();
    stage = "origin";
    requireSameOrigin(request);
    stage = "body";
    const input = await readRsvpJson(request);
    stage = "session";
    const session = await requireOrganizerSession(request, input.csrfToken);
    stage = "rate-limit";
    await rateLimit(request, "response", session.tokenHash);
    stage = "save";
    return privateJson({ ok: true, ...await deleteGuest(input) });
  } catch (error) {
    return rejectedRequest(error, "DELETE", stage);
  }
}
`;
  write(rel, source);
}

console.log('Guest-list backend controls enabled.');
