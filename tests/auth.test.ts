import { describe, it, expect, vi, beforeEach } from "vitest";

const signUpMock = vi.fn();
const signInWithPasswordMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      signUp: signUpMock,
      signInWithPassword: signInWithPasswordMock,
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

describe("auth actions", () => {
  beforeEach(() => {
    signUpMock.mockReset();
    signInWithPasswordMock.mockReset();
  });

  it("signUp: returns error when email invalid", async () => {
    const { signUp } = await import("@/lib/auth/actions");
    const result = await signUp({ email: "not-an-email", password: "pw12345!" });
    expect(result.error).toMatch(/이메일/);
  });

  it("signUp: returns error when password too short", async () => {
    const { signUp } = await import("@/lib/auth/actions");
    const result = await signUp({ email: "a@b.com", password: "short" });
    expect(result.error).toMatch(/비밀번호/);
  });

  it("signUp: calls supabase signUp when valid", async () => {
    signUpMock.mockResolvedValue({ error: null });
    const { signUp } = await import("@/lib/auth/actions");
    const result = await signUp({ email: "a@b.com", password: "pw12345!" });
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@b.com" })
    );
    expect(result.error).toBeUndefined();
  });

  it("signIn: returns error on bad credentials", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const { signIn } = await import("@/lib/auth/actions");
    const result = await signIn({ email: "a@b.com", password: "wrong" });
    expect(result.error).toBeTruthy();
  });
});
