import { test, expect } from "@playwright/test";

/**
 * Keep this list empty unless a warning is confirmed to come from a dependency
 * and cannot be fixed in the application. Each exception must be explained in
 * the test output and in docs/testing/browser-console.md.
 */
const acceptedThirdPartyWarnings: RegExp[] = [];

test("the landing page has no browser console errors or warnings", async ({
  page,
}) => {
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      const text = message.text();
      if (!acceptedThirdPartyWarnings.some((pattern) => pattern.test(text))) {
        consoleMessages.push(`[${message.type()}] ${text}`);
      }
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(`[pageerror] ${error.message}`);
  });

  await page.goto("/");
  await expect(page).toHaveTitle(/Transcendix/);
  await expect(page.locator("body")).not.toBeEmpty();

  expect(
    [...pageErrors, ...consoleMessages],
    [
      "Unexpected browser diagnostics:",
      ...pageErrors,
      ...consoleMessages,
    ].join("\n"),
  ).toEqual([]);
});
