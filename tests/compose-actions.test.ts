import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();
const selectConnectionMock = vi.fn();
const insertPostMock = vi.fn();
const publishPostMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "linkedin_connections") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: selectConnectionMock }),
          }),
        };
      }
      if (table === "posts") {
        return {
          insert: insertPostMock,
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock("@/lib/auth/get-user", () => ({
  requireUser: getUserMock,
}));

vi.mock("@/lib/linkedin/client", () => ({
  publishPost: publishPostMock,
}));

vi.mock("@/lib/crypto/encrypt", () => ({
  decryptToken: () => "decrypted_access_token",
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

beforeEach(() => {
  getUserMock.mockReset();
  selectConnectionMock.mockReset();
  insertPostMock.mockReset();
  publishPostMock.mockReset();
});

describe("publishToLinkedIn action", () => {
  it("returns error if content empty", async () => {
    const { publishToLinkedIn } = await import(
      "@/app/(dashboard)/compose/actions"
    );
    const result = await publishToLinkedIn({ content: "   " });
    expect(result.error).toMatch(/내용/);
  });

  it("returns error if no connection", async () => {
    getUserMock.mockResolvedValue({ id: "user-1" });
    selectConnectionMock.mockResolvedValue({ data: null });

    const { publishToLinkedIn } = await import(
      "@/app/(dashboard)/compose/actions"
    );
    const result = await publishToLinkedIn({ content: "hello" });
    expect(result.error).toMatch(/LinkedIn/);
  });

  it("publishes and records success", async () => {
    getUserMock.mockResolvedValue({ id: "user-1" });
    selectConnectionMock.mockResolvedValue({
      data: {
        linkedin_sub: "li-sub",
        access_token_ciphertext: "ct",
        access_token_iv: "iv",
        access_token_tag: "tag",
      },
    });
    insertPostMock.mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: "p1" }, error: null }),
      }),
    });
    publishPostMock.mockResolvedValue({ urn: "urn:li:share:42" });

    const { publishToLinkedIn } = await import(
      "@/app/(dashboard)/compose/actions"
    );
    const result = await publishToLinkedIn({ content: "hello world" });

    expect(publishPostMock).toHaveBeenCalledWith({
      accessToken: "decrypted_access_token",
      authorSub: "li-sub",
      commentary: "hello world",
    });
    expect(result.urn).toBe("urn:li:share:42");
  });
});
