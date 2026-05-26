import { test, expect } from "@playwright/test";

test("login → dashboard → connections page", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL!;
  const password = process.env.E2E_TEST_PASSWORD!;

  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(
    page.getByRole("heading", { name: /안녕하세요/ })
  ).toBeVisible();

  await page
    .getByRole("navigation")
    .getByRole("link", { name: "채널 연동" })
    .click();
  await expect(
    page.getByRole("heading", { name: "채널 연동" })
  ).toBeVisible();
  await expect(page.getByText("LinkedIn")).toBeVisible();
});
