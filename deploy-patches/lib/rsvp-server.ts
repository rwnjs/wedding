import { getOrganizerUser, type OrganizerUser } from "./organizer-auth";
import type { OrganizerPayload, RsvpResponse, RsvpSessionPayload } from "./rsvp-types";
import { equalToken, nameKey, RsvpError } from "./rsvp-validation";
import {
  findGuestByNameKey,
  getGuest,
  getRate,
  getResponse,
  getSession,
  listGuests,
  listResponses,
  saveRate,
  saveSession,
  type StoredGuest,
  type StoredResponse,
  type StoredSession,
} from "./blob-rsvp-store";

const COOKIE_NAME = "nr_rsvp_session";
const ORGANIZER_COOKIE_NAME = "nr_organizer_session";
const SESSION_TTL_SECONDS = 60 * 24 * 60 * 60;
const HOUR = 60 * 60 * 1000;
export type RsvpSession = StoredSession;

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cookieToken(request: Request, cookieName = COOKIE_NAME): string | null {
  const entry = (request.headers.get("cookie") || "")
    .split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  if (!entry) return null;
  const token = entry.slice(cookieName.length + 1);
  return /^[a-f0-9]{64}$/u.test(token) ? token : null;
}

function sessionCookie(request: Request, token: string, cookieName = COOKIE_NAME): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_TTL_SECONDS : 0}${secure}`;
}

function sessionCookieHeaders(request: Request, token: string, cookieName = COOKIE_NAME): Headers {
  return new Headers({ "Set-Cookie": sessionCookie(request, token, cookieName) });
}

export function clearGuestSessionCookies(request: Request, headers: Headers): void {
  for (const cookie of sessionCookieHeaders(request, "").getSetCookie()) headers.append("Set-Cookie", cookie);
}

export function privateJson(data: unknown, status = 200, additionalHeaders?: HeadersInit): Response {
  const headers = new Headers(additionalHeaders);
  headers.set("Cache-Control", "no-store, private");
  headers.set("Vary", "Cookie");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  return Response.json(data, { status, headers });
}

export function rsvpErrorResponse(error: unknown): Response {
  if (error instanceof RsvpError) {
    return privateJson({ error: error.message, ...(error.code ? { code: error.code } : {}), ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}) }, error.status);
  }
  console.error("Wedding RSVP request failed", error instanceof Error ? error.name : "UnknownError");
  return privateJson({ error: "We could not complete that request. Please try again in a moment." }, 503);
}

export function serializeRsvp(row: StoredResponse, guest?: StoredGuest | null): RsvpResponse {
  return {
    id: row.id,
    guestId: row.guestId,
    fullName: guest?.fullName ?? row.fullName,
    attendance: row.attendance,
    plusOne: row.attendance === "attending" && row.plusOne,
    companionName: row.attendance === "attending" && row.plusOne ? row.companionName : "",
    songRequest: row.songRequest,
    allowPlusOne: guest?.allowPlusOne ?? false,
    guestActive: guest?.active ?? false,
    message: row.message,
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export async function rateLimit(request: Request, action: "session" | "organizer-session" | "response" | "access" | "login", fallback?: string): Promise<void> {
  const address = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!address && !fallback) return;
  const now = Date.now();
  const bucket = Math.floor(now / HOUR);
  const key = await digest(`${action}:${bucket}:${address || fallback}`);
  const existing = await getRate(key);
  const hits = existing && existing.expiresAt > now ? existing.hits + 1 : 1;
  await saveRate({ key, hits, expiresAt: (bucket + 2) * HOUR });
  if (hits > (action === "login" ? 10 : action === "response" ? 120 : 60)) {
    throw new RsvpError(429, "Too many attempts. Please try again in a little while.");
  }
}

async function readScopedSession(request: Request, organizer = false): Promise<RsvpSession | null> {
  const token = cookieToken(request, organizer ? ORGANIZER_COOKIE_NAME : COOKIE_NAME);
  if (!token) return null;
  const tokenHash = (organizer ? "organizer:" : "") + await digest(token);
  const row = await getSession(tokenHash);
  return row && row.expiresAt > Date.now() ? row : null;
}

export async function readSession(request: Request): Promise<RsvpSession | null> { return readScopedSession(request); }

export async function requireGuestSession(request: Request, csrfToken: unknown): Promise<RsvpSession> {
  const session = await readSession(request);
  if (!session || typeof csrfToken !== "string" || !equalToken(session.csrfToken, csrfToken)) {
    throw new RsvpError(403, "Your RSVP form has expired. Please reload the page and try again.", undefined, "SESSION_EXPIRED");
  }
  return session;
}

export async function requireOrganizerSession(request: Request, csrfToken: unknown): Promise<RsvpSession> {
  const session = await readScopedSession(request, true);
  if (!session || typeof csrfToken !== "string" || !equalToken(session.csrfToken, csrfToken)) {
    throw new RsvpError(403, "Your organizer session has expired. Please try saving again.", undefined, "SESSION_EXPIRED");
  }
  return session;
}

export async function sessionInvitation(session: RsvpSession): Promise<StoredGuest | null> {
  if (!session.guestId || session.invitationVersion === null || session.expiresAt <= Date.now()) return null;
  const guest = await getGuest(session.guestId);
  return guest && guest.invitationVersion === session.invitationVersion && guest.active ? guest : null;
}

async function sessionPayload(session: RsvpSession): Promise<RsvpSessionPayload> {
  const guest = await sessionInvitation(session);
  const row = guest ? await getResponse(guest.id) : null;
  return {
    csrfToken: session.csrfToken,
    invitation: guest ? { id: guest.id, fullName: guest.fullName, allowPlusOne: guest.allowPlusOne } : null,
    response: row ? serializeRsvp(row, guest) : null,
    invitationState: guest ? "ready" : session.guestId ? "unavailable" : "missing",
  };
}

export async function createSessionResponse(request: Request, guest?: StoredGuest): Promise<Response> {
  if (!guest) await rateLimit(request, "session");
  const rawToken = randomToken();
  const now = Date.now();
  const session: StoredSession = {
    tokenHash: await digest(rawToken), csrfToken: randomToken(), guestId: guest?.id ?? null,
    invitationVersion: guest?.invitationVersion ?? null, sharedAccessVersion: null,
    createdAt: now, expiresAt: now + SESSION_TTL_SECONDS * 1000,
  };
  await saveSession(session);
  return privateJson(await sessionPayload(session), 200, sessionCookieHeaders(request, rawToken));
}

export async function getOrganizerSessionResponse(request: Request): Promise<Response> {
  const owner = await requireOrganizer();
  const existing = await readScopedSession(request, true);
  if (existing) return privateJson({ csrfToken: existing.csrfToken });
  await rateLimit(request, "organizer-session", owner.userId);
  const rawToken = randomToken();
  const now = Date.now();
  const session: StoredSession = {
    tokenHash: "organizer:" + await digest(rawToken), csrfToken: randomToken(), guestId: null,
    invitationVersion: null, sharedAccessVersion: null, createdAt: now,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
  };
  await saveSession(session);
  return privateJson({ csrfToken: session.csrfToken }, 200, sessionCookieHeaders(request, rawToken, ORGANIZER_COOKIE_NAME));
}

export async function getSessionResponse(request: Request): Promise<Response> {
  const session = await readSession(request);
  if (!session) return createSessionResponse(request);
  return privateJson(await sessionPayload(session));
}

export async function openRsvpAccess(request: Request, fullName: unknown): Promise<Response> {
  await rateLimit(request, "access", "shared-event-access");
  const unavailable = () => new RsvpError(404, "We could not open your RSVP. Please check your full name or contact the couple.");
  const key = typeof fullName === "string" ? nameKey(fullName) : "";
  if (key.length < 2 || key.length > 120 || /[\u0000-\u001f\u007f]/u.test(key)) throw unavailable();
  const guest = await findGuestByNameKey(key);
  if (!guest || !guest.active) throw unavailable();
  return createSessionResponse(request, guest);
}

export type OrganizerAccess =
  | { authorized: true; user: OrganizerUser }
  | { authorized: false; status: 401 | 403 | 503; message: string };

export async function getOrganizerAccess(): Promise<OrganizerAccess> {
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) return { authorized: false, status: 503, message: "Organizer access is not available right now. Please try again later." };
  const user = await getOrganizerUser();
  if (!user) return { authorized: false, status: 401, message: "Please sign in to open the organizer page." };
  if (user.email.trim().toLowerCase() !== ownerEmail) return { authorized: false, status: 403, message: "This page is only available to the wedding organizer." };
  return { authorized: true, user };
}

export async function requireOrganizer(): Promise<OrganizerUser> {
  const access = await getOrganizerAccess();
  if (!access.authorized) throw new RsvpError(access.status, access.message);
  return access.user;
}

export async function organizerResponses(): Promise<OrganizerPayload> {
  const [guestRows, rows] = await Promise.all([listGuests(), listResponses()]);
  guestRows.sort((a, b) => a.nameKey.localeCompare(b.nameKey, "en-PH") || a.id.localeCompare(b.id));
  rows.sort((a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id));
  const responseByGuest = new Map(rows.filter((row) => row.guestId).map((row) => [row.guestId as string, row]));
  const guests = guestRows.map((guest) => {
    const response = responseByGuest.get(guest.id);
    return {
      id: guest.id, fullName: guest.fullName, allowPlusOne: guest.allowPlusOne, active: guest.active,
      createdAt: new Date(guest.createdAt).toISOString(), updatedAt: new Date(guest.updatedAt).toISOString(),
      response: response ? { ...serializeRsvp(response, guest), createdAt: new Date(response.createdAt).toISOString() } : null,
    };
  });
  const activeGuests = guests.filter((guest) => guest.active);
  const confirmed = activeGuests.filter((guest) => guest.response?.attendance === "attending");
  const declined = activeGuests.filter((guest) => guest.response?.attendance === "declining");
  const plusOnes = confirmed.filter((guest) => guest.response?.plusOne).length;
  const legacyResponses = rows.filter((row) => !row.guestId).map((row) => ({ ...serializeRsvp(row), createdAt: new Date(row.createdAt).toISOString() }));
  return {
    guests, legacyResponses,
    totals: {
      invited: activeGuests.length, attendingInvitees: confirmed.length, declinedInvitees: declined.length,
      plusOnes, totalAttending: confirmed.length + plusOnes,
      pending: activeGuests.filter((guest) => !guest.response).length,
      inactive: guests.length - activeGuests.length, legacyReplies: legacyResponses.length,
    },
  };
}
