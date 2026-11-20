// Optional access key. When ACCESS_KEY is set, everything except the landing page and the
// Telegram webhook (which has its own BOT_SECRET) needs HTTP Basic auth with that key as the password.
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const key = process.env.ACCESS_KEY;
  if (!key) return NextResponse.next();
  const p = req.nextUrl.pathname;
  if (p.startsWith("/landing") || p === "/api/telegram") return NextResponse.next();
  const auth = req.headers.get("authorization") || "";
  const [scheme, value] = auth.split(" ");
  if (scheme === "Basic" && value) {
    const decoded = atob(value);
    const pass = decoded.slice(decoded.indexOf(":") + 1);
    if (pass === key) return NextResponse.next();
  }
  return new NextResponse("Orbit is private. Enter any username and the access key as the password.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Orbit"' },
  });
}

export const config = { matcher: ["/((?!_next/|favicon.ico|demo/).*)"] };
