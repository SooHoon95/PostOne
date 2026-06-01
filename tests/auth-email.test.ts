import { describe, it, expect, vi, beforeEach } from "vitest";
import { REMEMBER_COOKIE } from "@/lib/supabase/cookie-options";

const signUpMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const resendMock = vi.fn();
const cookieSetMock = vi.fn();
const cookieDeleteMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      signUp: signUpMock,
      signInWithPassword: signInWithPasswordMock,
      resend: resendMock,
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: cookieSetMock, delete: cookieDeleteMock }),
}));

describe("email-verification auth actions", () => {
  beforeEach(() => {
    signUpMock.mockReset();
    signInWithPasswordMock.mockReset();
    resendMock.mockReset();
    cookieSetMock.mockReset();
    cookieDeleteMock.mockReset();
  });

  // ── signUp ──────────────────────────────────────────────────────────────
  it("signUp rejects an invalid email before calling supabase", async () => {
    const { signUp } = await import("@/lib/auth/actions");
    const r = await signUp({ email: "bad", password: "pw12345!" });
    expect(r.error).toMatch(/이메일/);
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("signUp rejects a password shorter than 8 chars", async () => {
    const { signUp } = await import("@/lib/auth/actions");
    const r = await signUp({ email: "a@b.com", password: "short" });
    expect(r.error).toMatch(/비밀번호/);
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("signUp returns ok and does not leak account existence", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { identities: [] }, session: null },
      error: null,
    });
    const { signUp } = await import("@/lib/auth/actions");
    const r = await signUp({ email: "a@b.com", password: "pw12345!" });
    expect(r).toEqual({ ok: true });
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@b.com" })
    );
  });

  it("signUp surfaces a supabase error", async () => {
    signUpMock.mockResolvedValue({ data: {}, error: { message: "boom" } });
    const { signUp } = await import("@/lib/auth/actions");
    const r = await signUp({ email: "a@b.com", password: "pw12345!" });
    expect(r.error).toBe("boom");
  });

  // ── resendConfirmation ──────────────────────────────────────────────────
  it("resendConfirmation validates email before calling supabase", async () => {
    const { resendConfirmation } = await import("@/lib/auth/actions");
    const r = await resendConfirmation({ email: "bad" });
    expect(r.error).toBeTruthy();
    expect(resendMock).not.toHaveBeenCalled();
  });

  it("resendConfirmation calls supabase resend with type signup", async () => {
    resendMock.mockResolvedValue({ error: null });
    const { resendConfirmation } = await import("@/lib/auth/actions");
    const r = await resendConfirmation({ email: "a@b.com" });
    expect(resendMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signup", email: "a@b.com" })
    );
    expect(r.error).toBeUndefined();
  });

  it("resendConfirmation surfaces a supabase error (e.g. rate limit)", async () => {
    resendMock.mockResolvedValue({
      error: { message: "email rate limit exceeded" },
    });
    const { resendConfirmation } = await import("@/lib/auth/actions");
    const r = await resendConfirmation({ email: "a@b.com" });
    expect(r.error).toMatch(/rate limit/);
  });

  // ── signIn ──────────────────────────────────────────────────────────────
  it("signIn maps unconfirmed email to a verify code and clears remember cookie", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { message: "Email not confirmed", code: "email_not_confirmed" },
    });
    const { signIn } = await import("@/lib/auth/actions");
    const r = await signIn({ email: "a@b.com", password: "pw12345!" });
    expect(r.code).toBe("email_not_confirmed");
    expect(r.error).toMatch(/인증/);
    expect(cookieDeleteMock).toHaveBeenCalledWith(REMEMBER_COOKIE);
  });

  it("signIn returns a generic error on bad credentials and clears remember cookie", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const { signIn } = await import("@/lib/auth/actions");
    const r = await signIn({ email: "a@b.com", password: "x" });
    expect(r.error).toMatch(/이메일 또는 비밀번호/);
    expect(r.code).toBeUndefined();
    expect(cookieDeleteMock).toHaveBeenCalledWith(REMEMBER_COOKIE);
  });

  it("signIn succeeds: redirects to /dashboard and sets a persistent remember cookie", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    const { signIn } = await import("@/lib/auth/actions");
    await expect(
      signIn({ email: "a@b.com", password: "pw12345!", remember: true })
    ).rejects.toThrow("redirect:/dashboard");
    const call = cookieSetMock.mock.calls.find((c) => c[0] === REMEMBER_COOKIE);
    expect(call).toBeTruthy();
    expect(call?.[1]).toBe("1");
    expect(call?.[2]).toEqual(
      expect.objectContaining({ maxAge: expect.any(Number) })
    );
    expect(cookieDeleteMock).not.toHaveBeenCalled();
  });

  it("signIn without remember sets a session cookie (no maxAge)", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    const { signIn } = await import("@/lib/auth/actions");
    await expect(
      signIn({ email: "a@b.com", password: "pw12345!", remember: false })
    ).rejects.toThrow("redirect:/dashboard");
    const call = cookieSetMock.mock.calls.find((c) => c[0] === REMEMBER_COOKIE);
    expect(call?.[1]).toBe("0");
    expect(call?.[2]?.maxAge).toBeUndefined();
  });
});
