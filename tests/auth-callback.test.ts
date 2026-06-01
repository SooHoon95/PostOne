import { describe, it, expect, vi, beforeEach } from "vitest";

const exchangeMock = vi.fn();
const verifyOtpMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { exchangeCodeForSession: exchangeMock, verifyOtp: verifyOtpMock },
  }),
}));

async function call(urlStr: string) {
  const { GET } = await import("@/app/auth/callback/route");
  return GET(new Request(urlStr));
}

describe("auth callback route", () => {
  beforeEach(() => {
    exchangeMock.mockReset();
    verifyOtpMock.mockReset();
  });

  it("valid code exchanges session and redirects to /dashboard", async () => {
    exchangeMock.mockResolvedValue({ error: null });
    const res = await call("https://app.test/auth/callback?code=abc");
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("exchange error redirects to /login?error=verify_failed", async () => {
    exchangeMock.mockResolvedValue({ error: { message: "bad" } });
    const res = await call("https://app.test/auth/callback?code=abc");
    expect(res.headers.get("location")).toContain("/login?error=verify_failed");
  });

  it("supabase error param redirects to link_expired", async () => {
    const res = await call(
      "https://app.test/auth/callback?error=access_denied&error_description=expired"
    );
    expect(res.headers.get("location")).toContain("error=link_expired");
  });

  it("missing code/token redirects to invalid_link", async () => {
    const res = await call("https://app.test/auth/callback");
    expect(res.headers.get("location")).toContain("error=invalid_link");
  });

  it("token_hash without type redirects to invalid_link", async () => {
    const res = await call("https://app.test/auth/callback?token_hash=xyz");
    expect(res.headers.get("location")).toContain("error=invalid_link");
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });

  it("type without token_hash redirects to invalid_link", async () => {
    const res = await call("https://app.test/auth/callback?type=signup");
    expect(res.headers.get("location")).toContain("error=invalid_link");
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });

  it("prevents absolute-url open redirect via next", async () => {
    exchangeMock.mockResolvedValue({ error: null });
    const res = await call(
      "https://app.test/auth/callback?code=abc&next=https://evil.com/x"
    );
    const loc = res.headers.get("location") ?? "";
    expect(loc).not.toContain("evil.com");
    expect(loc).toContain("/dashboard");
  });

  it("prevents protocol-relative open redirect via next", async () => {
    exchangeMock.mockResolvedValue({ error: null });
    const res = await call(
      "https://app.test/auth/callback?code=abc&next=//evil.com"
    );
    expect(res.headers.get("location") ?? "").not.toContain("evil.com");
  });

  it("token_hash + type verifies otp and redirects", async () => {
    verifyOtpMock.mockResolvedValue({ error: null });
    const res = await call(
      "https://app.test/auth/callback?token_hash=xyz&type=signup"
    );
    expect(verifyOtpMock).toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("verifyOtp error redirects to /login?error=verify_failed", async () => {
    verifyOtpMock.mockResolvedValue({ error: { message: "expired" } });
    const res = await call(
      "https://app.test/auth/callback?token_hash=xyz&type=signup"
    );
    expect(res.headers.get("location")).toContain("error=verify_failed");
  });
});
