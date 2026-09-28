# FE-01 design contract — Cedar & Paw Veterinary

Status: design draft for human review. The user approved the scope and retained
asset strategy; this specific visual design and wording have not yet been frozen.
No working frontend implementation or approved visual baseline is claimed by this draft.
The executable browser checks and three proposed PNG references await review/freeze.

## Accepted scope

Default implementation: vanilla JavaScript, HTML, and CSS. Serve from the existing
frontend process; use the published backend APIs directly. Preserve observable
branding, layout, text, and interactions across reconstruction, not source identity.
Frontend deletion/reconstruction is a separate experiment **after** Checkout's
Python experiment. No frontend deletion is authorized by this specification.

The five screen types in `screens.md` cover login, appointment list/detail,
appointment request, clinical visit recording, and bill/payment. The demo retains
two veterinarians and assigned-veterinarian permissions. Additional business
workflows remain covered by backend tests; do not add registration, administration,
pet removal, promotions, cash recording, or catalog-editing UI in this slice.

## Identity and retained assets

- Name: **Cedar & Paw Veterinary**. Short wordmark: **Cedar & Paw**.
- Tagline on login: **Good care, every step.**
- Style: warm, quiet, practical clinic workspace. Ivory canvas, white surfaces,
  deep evergreen navigation/actions, restrained sage accents. No stock photography,
  gradients, animated decoration, or externally fetched assets.
- Logo: original geometric paw SVG in `assets/cedar-paw.svg`. Use beside the text
  wordmark; decorative image alt is empty when adjacent text supplies the name.
- Font: locally bundled Inter Latin, normal weights 400 and 600 from Fontsource
  5.3.0, under OFL-1.1. Retain font files and license; no runtime font CDN.
- Canonical tokens and shared components: `styles/clinic.css`. Serve these exact
  frozen bytes. Asset paths in the stylesheet are relative to its own directory.

## Desktop layout

- Reference viewport: 1440 × 1000 CSS pixels, device scale factor 1, light theme.
- Signed-in shell: 232px evergreen sidebar, main content padded 48px, maximum
  content width 1120px. Sidebar contains wordmark, `Appointments`, user identity,
  role, and `Sign out`. No nonfunctional navigation items.
- Main content: eyebrow `CUSTOMER PORTAL` or `VETERINARIAN WORKSPACE`, one h1,
  a short explanation, then the relevant panel. Form/bill pages use a flexible
  main column and a 300px summary column with a 24px gap.
- Login: centered 1000px two-column panel, evergreen introduction and white form.
- Typography: h1 36px/1.2, h2 22px/1.3, body 16px/1.6, labels 14px/1.4,
  eyebrow 12px with 0.1em letter spacing. Only weights 400 and 600.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48px. Panel radius 16px, control radius
  8px, control minimum height 44px. Use 1px borders, no large shadows.
- Color tokens, control states, and component proportions are defined in CSS.
  Status is always expressed as text as well as color.
- Desktop is the acceptance target. Keep ordinary document scrolling and usable
  intrinsic sizing, but mobile design and mobile screenshots are outside FE-01.

## Accessible behavior

Use semantic headings, navigation, main, forms, tables with header cells, buttons,
and explicitly associated labels. Group service checkboxes in a fieldset with a
legend. Every action works by keyboard and has a visible focus outline. Do not
make clickable divs or rely on placeholders as labels. Focus the page heading on
navigation, error summary on failed submission, and confirmation on success.
Use role=status for nonurgent progress/success and role=alert for errors. Avoid
announcing sensitive clinical text. Normal text must meet WCAG AA contrast.

## Reconstruction boundary

Retain `spec/`, including this design, screen contract, CSS, SVG, font/license,
human-approved PNG baselines, and independently executable browser tests. Retain
backend services and their existing specifications. Delete only `frontend/` in a
disposable, explicitly authorized experiment workspace, including its setup/start,
HTML, routing, network code, and any copied build assets. Regenerate those files.

The application may serve or copy the retained asset bytes; it may not overwrite
them, broaden visual tolerances, update expected images, or alter test selectors
to pass. Tests must run without importing frontend source. Disclose the retained
CSS/assets and requirements in the demonstration; this experiment does not claim
that the visual design was invented again from nothing.

`docs/fe-01-design-preview.html` is an inert design-review artifact, not the
application or an executable specification. Exclude it and prior frontend source,
history, build output, and screenshots of failed rebuilds from the agent's initial
reconstruction inputs. Approved protected baselines remain available. A different
implementation language/framework must still emit equivalent HTML/CSS behavior.

## Review sequence

1. Review the screen specification, identity, and static preview.
2. Author protected browser features/tests and harness integration against these
   reviewed expectations. Record genuine missing-UI failures; no skipped tests.
3. Generate and inspect reference images independently from the candidate app;
   approve the baseline environment and small tolerance. Do not bless a candidate
   app's screenshots solely because its behavioral tests pass.
4. Human reviews and runs `npm --prefix spec run guard:freeze` for the complete
   specification/test/baseline set. The agent never runs freeze.
5. Implement frontend, run full validation and ENG-01, and checkpoint.

Detailed browser coverage and baseline rules: `../tests/browser/README.md` and
`visual-baselines/README.md`. Missing expected images must fail; ordinary test
runs must not write or update protected baselines.
