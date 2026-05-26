import { describe, it, expect, vi } from "vitest";

const limitMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: limitMock,
          }),
        }),
      }),
    }),
  }),
}));

describe("getRecentPosts", () => {
  it("returns posts ordered desc limited to N", async () => {
    limitMock.mockResolvedValue({
      data: [
        {
          id: "p1",
          content: "hello",
          status: "success",
          created_at: "2026-05-26T00:00:00Z",
        },
      ],
      error: null,
    });
    const { getRecentPosts } = await import("@/lib/posts/queries");
    const posts = await getRecentPosts("u1", 30);
    expect(posts).toHaveLength(1);
    expect(limitMock).toHaveBeenCalledWith(30);
  });

  it("returns empty array on error", async () => {
    limitMock.mockResolvedValue({ data: null, error: { message: "x" } });
    const { getRecentPosts } = await import("@/lib/posts/queries");
    const posts = await getRecentPosts("u1", 30);
    expect(posts).toEqual([]);
  });
});
