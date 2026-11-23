import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "taskhive_session";
const SESSION_IDLE_TIMEOUT_SECONDS = 5 * 60;
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET!);

async function setSessionCookie(userId: number) {
  const token = await new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_IDLE_TIMEOUT_SECONDS)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_IDLE_TIMEOUT_SECONDS,
  });
}

export async function createSession(userId: number) {
  await setSessionCookie(userId);
}

export async function readSession(): Promise<number | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  let userId: number;
  try {
    const { payload } = await jwtVerify(token, secret());
    userId = Number(payload.sub);
  } catch {
    return null;
  }
  if (!Number.isSafeInteger(userId) || userId < 1) return null;
  await setSessionCookie(userId);
  return userId;
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}