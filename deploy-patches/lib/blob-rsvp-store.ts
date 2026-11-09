import { get, list, put } from "@vercel/blob";
import { createHash } from "node:crypto";

export type StoredGuest = {
  id: string;
  fullName: string;
  nameKey: string;
  invitationVersion: number;
  allowPlusOne: boolean;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

export type StoredResponse = {
  id: string;
  sessionHash: string;
  guestId: string | null;
  fullName: string;
  attendance: "attending" | "declining";
  plusOne: boolean;
  companionName: string;
  songRequest: string;
  message: string;
  createdAt: number;
  updatedAt: number;
};

export type StoredSession = {
  tokenHash: string;
  csrfToken: string;
  guestId: string | null;
  invitationVersion: number | null;
  sharedAccessVersion: number | null;
  createdAt: number;
  expiresAt: number;
};

export type StoredRate = { key: string; hits: number; expiresAt: number };

type NameIndex = { id: string; nameKey: string };

const ACCESS = "private" as const;
const GUEST_PREFIX = "rsvp/guests/";
const RESPONSE_PREFIX = "rsvp/responses/";
const SESSION_PREFIX = "rsvp/sessions/";
const RATE_PREFIX = "rsvp/rates/";
const NAME_PREFIX = "rsvp/name-index/";

function keyDigest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function guestPath(id: string) { return `${GUEST_PREFIX}${id}.json`; }
function responsePath(guestId: string) { return `${RESPONSE_PREFIX}${guestId}.json`; }
function sessionPath(tokenHash: string) { return `${SESSION_PREFIX}${keyDigest(tokenHash)}.json`; }
function ratePath(key: string) { return `${RATE_PREFIX}${keyDigest(key)}.json`; }
function namePath(nameKey: string) { return `${NAME_PREFIX}${keyDigest(nameKey)}.json`; }

async function readJson<T>(pathname: string): Promise<T | null> {
  const result = await get(pathname, { access: ACCESS });
  if (!result || result.statusCode !== 200) return null;
  try {
    return JSON.parse(await new Response(result.stream).text()) as T;
  } catch {
    return null;
  }
}

async function writeJson(pathname: string, value: unknown): Promise<void> {
  await put(pathname, JSON.stringify(value), {
    access: ACCESS,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

async function listJson<T>(prefix: string): Promise<T[]> {
  const values: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      const value = await readJson<T>(blob.pathname);
      if (value) values.push(value);
    }
    cursor = page.cursor;
  } while (cursor);
  return values;
}

export async function getGuest(id: string): Promise<StoredGuest | null> {
  return readJson<StoredGuest>(guestPath(id));
}

export async function findGuestByNameKey(nameKey: string): Promise<StoredGuest | null> {
  const index = await readJson<NameIndex>(namePath(nameKey));
  if (!index || index.nameKey !== nameKey) return null;
  const guest = await getGuest(index.id);
  return guest && guest.nameKey === nameKey ? guest : null;
}

export async function listGuests(): Promise<StoredGuest[]> {
  return listJson<StoredGuest>(GUEST_PREFIX);
}

export async function saveGuest(guest: StoredGuest): Promise<void> {
  await writeJson(guestPath(guest.id), guest);
  await writeJson(namePath(guest.nameKey), { id: guest.id, nameKey: guest.nameKey } satisfies NameIndex);
}

export async function getResponse(guestId: string): Promise<StoredResponse | null> {
  return readJson<StoredResponse>(responsePath(guestId));
}

export async function listResponses(): Promise<StoredResponse[]> {
  return listJson<StoredResponse>(RESPONSE_PREFIX);
}

export async function saveResponse(response: StoredResponse): Promise<void> {
  if (!response.guestId) throw new Error("A guest ID is required for Blob RSVP responses");
  await writeJson(responsePath(response.guestId), response);
}

export async function getSession(tokenHash: string): Promise<StoredSession | null> {
  return readJson<StoredSession>(sessionPath(tokenHash));
}

export async function saveSession(session: StoredSession): Promise<void> {
  await writeJson(sessionPath(session.tokenHash), session);
}

export async function getRate(key: string): Promise<StoredRate | null> {
  return readJson<StoredRate>(ratePath(key));
}

export async function saveRate(rate: StoredRate): Promise<void> {
  await writeJson(ratePath(rate.key), rate);
}
