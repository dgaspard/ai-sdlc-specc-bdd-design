# Visual reference policy

Status: the three PNGs here are proposed reference baselines awaiting human review
and freeze. They were rendered from the independent static design preview, not a
candidate frontend application. Their presence is not passing acceptance evidence.

Reference environment proposal: pinned Playwright 1.55.1 and its Chromium revision
1193; macOS 26.6.2 arm64 (current host). Record the actual browser version, OS,
architecture, font hashes, viewport 1440×1000, scale 1, light color scheme,
reduced motion, en-US locale, and America/Chicago timezone with approved images.
Use this same environment for both original and reconstructed frontend comparisons.
An environment upgrade requires an intentional reviewed baseline update; do not
loosen tolerances to accommodate unexplained platform differences. Docker is not
introduced by this decision.

Proposed comparison: `threshold: 0.2`, `maxDiffPixels: 100` per full viewport image,
animations disabled, caret hidden. This is a small raster tolerance, not permission
to change text/layout. Review/calibrate it using the fixed reference render and a
deliberate label, amount, and spacing defect; each defect must be detected by the
visual check or corresponding exact behavioral assertion before freezing.

Images: `login.png`, `appointments-requested.png`, `bill-unpaid.png`. Use deterministic
seeded names, date/time, and amounts from `screens.md`. Do not render random IDs in
these views; do not mask balances, clinical text, labels, statuses, or primary
actions. Wait for local fonts and the intended page state. Freeze approved images
and the environment record with the test configuration. No new snapshots produced
by a rebuilt application can become expected images without separate human review.

Playwright notes that rendering depends on browser and host environment:
https://playwright.dev/docs/test-snapshots
Headless/context configuration: https://playwright.dev/docs/test-use-options
