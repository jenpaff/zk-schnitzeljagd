import { PlaywrightTestConfig, devices } from "@playwright/test";
import path from "path";

// Use process.env.PORT by default and fallback to port 3000
// const PORT = process.env.PORT || 3000

// Set webServer.url and use.baseURL with the location of the WebServer respecting the correct set port
const baseURL = `http://localhost:3000`;

// Reference: https://playwright.dev/docs/test-configuration
const config: PlaywrightTestConfig = {
  // Timeout per test
  timeout: process.env.CI ? 90 * 3000 : 50 * 3000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5 * 60 * 1000,
  },
  // Test directory
  testDir: path.join(__dirname, "e2e"),
  // If a test fails, retry it additional 2 times
  retries: process.env.CI ? 2 : 0,
  // Artifacts folder where screenshots, videos, and traces are stored.
  outputDir: "test-results/",
  forbidOnly: !!process.env.CI,

  // Run your local dev server before starting the tests:
  // https://playwright.dev/docs/test-advanced#launching-a-development-web-server-during-the-tests
  webServer: {
    command: "npm run dev",
    url: baseURL,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },

  use: {
    browserName: "chromium",
    actionTimeout: 0,
    baseURL,
    headless: process.env.CI ? true : false,
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
    video: "on-first-retry",
    // if you wanna show video on slow motion: also increase timeout otherwise it won't work
    // launchOptions: {
    //   slowMo: 3000
    // },
    trace: "retain-on-failure",
    permissions: ["geolocation"],
  },
  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium-desktop",
      use: {
        browserName: "chromium",
        ...devices["Desktop Chrome"],
      },
    },
  ],
};
export default config;
