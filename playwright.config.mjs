import { defineConfig } from '@playwright/test';

const channels = process.env.PLAYWRIGHT_CHANNEL
  ? [process.env.PLAYWRIGHT_CHANNEL]
  : ['chrome', 'msedge'];
const modes = process.env.TEST_MODE ? [process.env.TEST_MODE] : ['file', 'hosted'];
const baseURL = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4273';
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 12_000 },
  workers: 1,
  fullyParallel: false,
  outputDir: `test-results/${channels.join('-')}-${modes.join('-')}`,
  reporter: [
    ['list'],
    ['json', { outputFile: `artifacts/browser-${channels.join('-')}-${modes.join('-')}.json` }],
  ],
  projects: channels.flatMap((channel) =>
    modes.map((mode) => ({
      name: `${channel}-${mode}`,
      metadata: { mode },
      use: {
        channel,
        browserName: 'chromium',
        baseURL,
        viewport: { width: 1280, height: 720 },
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
      },
    })),
  ),
  webServer: modes.includes('hosted')
    ? {
        command: 'npm run preview',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      }
    : undefined,
});
