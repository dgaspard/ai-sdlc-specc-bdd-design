import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 30000,
  expect: { timeout: 3000, toHaveScreenshot: { threshold: 0.2, maxDiffPixels: 100 } },
  updateSnapshots: 'none',
  snapshotPathTemplate: '{testDir}/../../frontend/visual-baselines/{arg}{ext}',
  outputDir: '../../../test-results/browser',
  reporter: [['list']],
  use: {
    browserName: 'chromium', headless: true, baseURL: 'http://localhost:3000',
    viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1,
    locale: 'en-US', timezoneId: 'America/Chicago', colorScheme: 'light',
    reducedMotion: 'reduce', screenshot: 'only-on-failure', trace: 'retain-on-failure',
    video: 'off',
  },
});
