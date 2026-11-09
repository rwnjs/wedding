import {
  findGuestByNameKey,
  getGuest,
  getResponse,
  saveGuest,
  saveResponse,
  type StoredResponse,
} from "./blob-rsvp-store";
import { serializeRsvp, sessionInvitation, type RsvpSession } from "./rsvp-server";
import { RsvpError, type RsvpFields, validateGuestEntry, validateGuestImport } from "./rsvp-validation";

export async function confirmGuest(session: RsvpSession, fields: RsvpFields) {
  if (!session.guestId || session.guestId !== fields.guestId) throw new RsvpError(403, "Please enter your full name before responding.");
  const guest = await sessionInvitation(session);
  if (!guest) throw new RsvpError(403, "Please enter your full name again or contact the couple.");
  if (fields.attendance === "attending" && fields.plusOne && !guest.allowPlusOne) {
    throw new RsvpError(400, "This invitation is for one guest.", { plusOne: "A +1 has not been included with this invitation." });
  }
  const now = Date.now();
  const current = await getResponse(guest.id);
  const row: StoredResponse = {
    id: current?.id ?? crypto.randomUUID(), sessionHash: session.tokenHash, guestId: guest.id, fullName: guest.fullName,
    attendance: fields.attendance, plusOne: fields.attendance === "attending" && fields.plusOne,
    companionName: fields.attendance === "attending" && fields.plusOne ? fields.companionName : "",
    songRequest: fields.songRequest, message: fields.message, createdAt: current?.createdAt ?? now, updatedAt: now,
  };
  await saveResponse(row);
  return serializeRsvp(row, guest);
}

export async function importGuests(input: Record<string, unknown>) {
  const entries = validateGuestImport(input);
  const unique = new Map<string, (typeof entries)[number]>();
  const duplicates: string[] = [];
  for (const entry of entries) {
    if (unique.has(entry.nameKey)) duplicates.push(entry.fullName);
    else unique.set(entry.nameKey, entry);
  }
  let added = 0;
  const now = Date.now();
  for (const entry of unique.values()) {
    const existing = await findGuestByNameKey(entry.nameKey);
    if (existing) { duplicates.push(entry.fullName); continue; }
    await saveGuest({
      id: crypto.randomUUID(), fullName: entry.fullName, nameKey: entry.nameKey,
      invitationVersion: 1, allowPlusOne: entry.allowPlusOne, active: true,
      createdAt: now, updatedAt: now,
    });
    added++;
  }
  return { added, duplicates };
}

export async function updateGuest(input: Record<string, unknown>) {
  if (typeof input.id !== "string" || !input.id || typeof input.active !== "boolean" || typeof input.allowPlusOne !== "boolean") {
    throw new RsvpError(400, "Please check this invitation and try again.");
  }
  const fields = validateGuestEntry(input);
  const current = await getGuest(input.id);
  if (!current) throw new RsvpError(404, "This invitation could not be found. Refresh the guest list.");
  const duplicate = await findGuestByNameKey(fields.nameKey);
  if (duplicate && duplicate.id !== input.id) throw new RsvpError(409, "That name is already on the guest list. For guests with the same name, include a middle name or initial.");
  if (!fields.allowPlusOne) {
    const response = await getResponse(input.id);
    if (response?.attendance === "attending" && response.plusOne) {
      throw new RsvpError(409, "This invitation could not be changed. A guest with a confirmed +1 must update to attending alone or not attending before you remove their +1 allowance.");
    }
  }
  const invitationVersion = (!input.active || current.nameKey !== fields.nameKey) ? current.invitationVersion + 1 : current.invitationVersion;
  await saveGuest({
    ...current, fullName: fields.fullName, nameKey: fields.nameKey, allowPlusOne: fields.allowPlusOne,
    active: input.active, invitationVersion, updatedAt: Date.now(),
  });
  return { id: input.id };
}
