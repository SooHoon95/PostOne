import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/get-user";
import { buildAuthUrl, generateState } from "@/lib/linkedin/oauth";

export async function GET() {
  await requireUser(); // 비로그인 시 /login으로

  const state = generateState();
  const url = buildAuthUrl(state);

  const response = NextResponse.redirect(url);
  response.cookies.set("linkedin_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 min
    path: "/",
  });
  return response;
}
