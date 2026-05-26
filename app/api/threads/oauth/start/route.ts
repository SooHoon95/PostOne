import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/get-user";
import { buildAuthUrl, generateState } from "@/lib/threads/oauth";

export async function GET() {
  await requireUser();
  const state = generateState();
  const url = buildAuthUrl(state);
  const response = NextResponse.redirect(url);
  response.cookies.set("threads_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
