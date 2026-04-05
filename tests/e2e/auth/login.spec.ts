/**
 * E2E test: Login flow — Clerk authentication
 *
 * Test cases:
 * 1. E2E: user navigates to /sign-in, enters credentials, lands on /dashboard
 * 2. E2E: unauthenticated user navigates to /dashboard → redirected to /sign-in
 *
 * Note: The credential-based login test requires Clerk test mode setup with
 * CLERK_TESTING_TOKEN or a testing user configured in the Clerk dashboard.
 * The redirect test works without any Clerk configuration.
 */
import { test, expect } from "@playwright/test";

test.describe("Login flow", () => {
  test("unauthenticated user navigates to /dashboard → redirected to /sign-in", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // Clerk middleware should redirect to sign-in
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("user navigates to /sign-in, enters credentials, lands on /dashboard", async ({
    page,
  }) => {
    // This test requires Clerk testing credentials set in environment:
    //   CLERK_E2E_EMAIL and CLERK_E2E_PASSWORD
    const email = process.env.CLERK_E2E_EMAIL;
    const password = process.env.CLERK_E2E_PASSWORD;

    test.skip(
      !email || !password,
      "CLERK_E2E_EMAIL and CLERK_E2E_PASSWORD not set — skipping credential login test"
    );

    await page.goto("/sign-in");

    // Wait for Clerk component to render
    await expect(
      page.locator(
        ".cl-rootBox, .cl-signIn-root, [data-clerk-component]"
      )
    ).toBeVisible({ timeout: 10_000 });

    // Enter email
    await page.getByLabel("Email address").fill(email!);
    await page.getByRole("button", { name: /continue/i }).click();

    // Enter password
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: /continue/i }).click();

    // Should land on /dashboard after successful login
    await page.waitForURL("**/dashboard", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("/sign-in page renders Clerk SignIn component", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(
      page.locator(
        ".cl-rootBox, .cl-signIn-root, [data-clerk-component]"
      )
    ).toBeVisible({ timeout: 10_000 });
  });

  test("/ (landing page) is publicly accessible", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    // Should NOT redirect to sign-in
    expect(page.url()).not.toContain("/sign-in");
  });
});
