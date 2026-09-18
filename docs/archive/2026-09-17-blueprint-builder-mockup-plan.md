> Transferred from Fabri-Cadabra on 2026-09-17 for historical reference. This document predates later four-wall, inch-only, and mobile-first decisions and should not be treated as the current UI specification.\n\n# Blueprint Builder Standalone Mockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone single-file Blueprint Builder mockup with synchronized Top, Wall A, and Wall B 2D projections of one shared tube model.

**Architecture:** Keep production `www/` untouched. Create one self-contained SVG-based HTML file under `fabrication_pro_capacitor/mockups/` and one Playwright regression spec that opens the file directly. Store members in real X/Y/Z inch coordinates, project the same member records into the active 2D view, and make snapping validate true 3D compatibility rather than projection overlap alone.

**Tech Stack:** HTML5, CSS, vanilla JavaScript, SVG, Pointer Events, Playwright 1.63.0.

**Spec:** `docs/superpowers/specs/2026-09-17-blueprint-builder-mockup-design.md`

## Global Constraints

- Prototype file: `fabrication_pro_capacitor/mockups/blueprint-builder.html`.
- Do not modify production `fabrication_pro_capacitor/www/` files.
- Do not change app version `1.0.8`, build/versionCode `1000017`, package `fabri-cadabra-capacitor`, or app ID `com.fabricationpro.app`.
- Workspace defaults: 20 ft width x 20 ft depth x 10 ft height.
- Tube profiles: 2 x 2, 3 x 3, and 2 x 6; all 1/8 in wall.
- Grid: 12 in major, 3 in intermediate, 1 in fine, 1 in snap increment.
- Views: Top = X/Y, Wall A = X/Z, Wall B = Y/Z.
- UI remains entirely 2D; no perspective or orbiting 3D view.
- Members are axis-aligned only in this prototype.
- 2 x 6 supports 0/90 degree face roll.
- Part quantity decrements on placement and increments on deletion.
- Object snaps must be 3D-aware.

---

### Task 1: Standalone shell, measurement parsing, workspace, and parts staging

**Files:**
- Create: `fabrication_pro_capacitor/tests/e2e/blueprint-builder.spec.mjs`
- Create: `fabrication_pro_capacitor/mockups/blueprint-builder.html`

**Interfaces:**
- Consumes: none.
- Produces: `parseMeasurement(value) -> number|null`, `formatMeasurement(inches) -> string`, `state.workspace`, `state.parts`, `addPart(profileKey, lengthInches, quantity)`, and DOM test hooks `#bp-width`, `#bp-depth`, `#bp-height`, `#profile`, `#part-length`, `#part-qty`, `#add-part`, `[data-part-id]`.

- [ ] **Step 1: Write the failing Playwright test for shell defaults and part staging**

```js
import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const mockupUrl = pathToFileURL(resolve('mockups/blueprint-builder.html')).href;

test('blueprint mockup defaults and stages tube quantities', async ({ page }) => {
  await page.goto(mockupUrl);
  await expect(page.getByRole('heading', { name: 'Blueprint Builder' })).toBeVisible();
  await expect(page.locator('#bp-width')).toHaveValue('20');
  await expect(page.locator('#bp-depth')).toHaveValue('20');
  await expect(page.locator('#bp-height')).toHaveValue('10');

  await page.locator('#profile').selectOption('2x6');
  await page.locator('#part-length').fill(`6' 4"`);
  await page.locator('#part-qty').fill('3');
  await page.locator('#add-part').click();

  const row = page.locator('[data-part-id]').first();
  await expect(row).toContainText('2 x 6 x 1/8');
  await expect(row).toContainText(`6'-4"`);
  await expect(row).toContainText('3 remaining');
});
```

- [ ] **Step 2: Run the test and verify it fails because the mockup file does not exist**

Run: `cd fabrication_pro_capacitor && npx playwright test tests/e2e/blueprint-builder.spec.mjs --project=desktop-chromium`

Expected: FAIL while navigating to `mockups/blueprint-builder.html`.

- [ ] **Step 3: Implement the self-contained page shell and measurement helpers**

Create `mockups/blueprint-builder.html` with semantic controls, embedded CSS, and embedded JS. Define fixed profile metadata:

```js
const PROFILES = {
  '2x2': { label: '2 x 2 x 1/8', a: 2, b: 2, wall: 0.125 },
  '3x3': { label: '3 x 3 x 1/8', a: 3, b: 3, wall: 0.125 },
  '2x6': { label: '2 x 6 x 1/8', a: 2, b: 6, wall: 0.125 },
};

const state = {
  workspace: { width: 240, depth: 240, height: 120 },
  view: 'top',
  plane: { top: 0, wallA: 0, wallB: 0 },
  parts: [],
  members: [],
  selectedMemberId: null,
};
```

Implement `parseMeasurement` to accept plain inches and feet/inch strings such as `6' 4"` and `6'-4"`; implement `formatMeasurement` as canonical feet/inches. Build `addPart` so every staged row gets a stable ID and `remaining` quantity.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `cd fabrication_pro_capacitor && npx playwright test tests/e2e/blueprint-builder.spec.mjs --project=desktop-chromium -g "defaults and stages"`

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add fabrication_pro_capacitor/mockups/blueprint-builder.html fabrication_pro_capacitor/tests/e2e/blueprint-builder.spec.mjs
git commit -m "feat: scaffold blueprint builder mockup"
```

### Task 2: Shared X/Y/Z member model and synchronized SVG projections

**Files:**
- Modify: `fabrication_pro_capacitor/mockups/blueprint-builder.html`
- Modify: `fabrication_pro_capacitor/tests/e2e/blueprint-builder.spec.mjs`

**Interfaces:**
- Consumes: `state.workspace`, `state.parts`.
- Produces: `placeMember(partId, view, u, v)`, `projectMember(member, view)`, `renderBlueprint()`, view buttons `[data-view="top|wallA|wallB"]`, `#placement-plane`, and SVG member nodes `[data-member-id]` carrying `data-axis`, `data-x`, `data-y`, `data-z` for test inspection.

- [ ] **Step 1: Add a failing synchronized-projection test**

Add a helper in the test that stages one 48 in 2 x 2 member, then place it through the mockup's exported test API:

```js
await page.evaluate(() => {
  const part = window.BlueprintMockup.state.parts[0];
  window.BlueprintMockup.placeMember(part.id, 'top', 24, 36);
});

await expect(page.locator('[data-member-id]')).toHaveCount(1);
const model = await page.evaluate(() => window.BlueprintMockup.state.members[0]);
expect(model).toMatchObject({ x: 24, y: 36, z: 0, axis: 'x', length: 48 });

await page.locator('[data-view="wallA"]').click();
await expect(page.locator(`[data-member-id="${model.id}"]`)).toBeVisible();
await page.locator('[data-view="wallB"]').click();
await expect(page.locator(`[data-member-id="${model.id}"]`)).toBeVisible();
```

- [ ] **Step 2: Run the focused test and verify it fails because shared placement/projection APIs do not exist**

Run: `cd fabrication_pro_capacitor && npx playwright test tests/e2e/blueprint-builder.spec.mjs --project=desktop-chromium -g "synchronized"`

Expected: FAIL with `BlueprintMockup.placeMember` missing.

- [ ] **Step 3: Implement model placement and projection math**

Use the member start endpoint as X/Y/Z. New members start along the horizontal axis of the active view:

```js
const VIEW_AXES = {
  top:   { u: 'x', v: 'y', hidden: 'z', horizontal: 'x', vertical: 'y' },
  wallA: { u: 'x', v: 'z', hidden: 'y', horizontal: 'x', vertical: 'z' },
  wallB: { u: 'y', v: 'z', hidden: 'x', horizontal: 'y', vertical: 'z' },
};
```

`placeMember(partId, view, u, v)` must read the view's hidden Placement Plane coordinate, create one member record, decrement source quantity only after validation succeeds, and render that same member through `projectMember` for all views. Perpendicular members render as end-on cross-sections rather than disappearing.

Expose a deliberately narrow test/debug surface:

```js
window.BlueprintMockup = {
  state,
  placeMember,
  projectMember,
  renderBlueprint,
};
```

- [ ] **Step 4: Run synchronized projection tests**

Run: `cd fabrication_pro_capacitor && npx playwright test tests/e2e/blueprint-builder.spec.mjs --project=desktop-chromium -g "synchronized"`

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add fabrication_pro_capacitor/mockups/blueprint-builder.html fabrication_pro_capacitor/tests/e2e/blueprint-builder.spec.mjs
git commit -m "feat: synchronize blueprint projection views"
```

### Task 3: Drag placement, move, rotate, face roll, delete, and quantity accounting

**Files:**
- Modify: `fabrication_pro_capacitor/mockups/blueprint-builder.html`
- Modify: `fabrication_pro_capacitor/tests/e2e/blueprint-builder.spec.mjs`

**Interfaces:**
- Consumes: `placeMember`, shared member model, SVG projection layer.
- Produces: `rotateMemberInView(memberId, view)`, `rotateMemberFace(memberId)`, `deleteMember(memberId)`, Pointer Events for drawer-to-SVG placement and member dragging, and edit controls `#rotate-member`, `#rotate-face`, `#delete-member`.

- [ ] **Step 1: Add failing tests for quantity, axis rotation, face roll, and deletion**

Use the debug surface for deterministic geometry assertions while keeping the actual pointer path covered by one drag test:

```js
await page.evaluate(() => {
  const part = window.BlueprintMockup.state.parts[0];
  window.BlueprintMockup.placeMember(part.id, 'top', 12, 12);
});
expect(await page.evaluate(() => window.BlueprintMockup.state.parts[0].remaining)).toBe(2);

const id = await page.evaluate(() => window.BlueprintMockup.state.members[0].id);
await page.evaluate((memberId) => window.BlueprintMockup.rotateMemberInView(memberId, 'top'), id);
expect(await page.evaluate(() => window.BlueprintMockup.state.members[0].axis)).toBe('y');

await page.evaluate((memberId) => window.BlueprintMockup.rotateMemberFace(memberId), id);
expect(await page.evaluate(() => window.BlueprintMockup.state.members[0].roll)).toBe(90);

await page.evaluate((memberId) => window.BlueprintMockup.deleteMember(memberId), id);
expect(await page.evaluate(() => window.BlueprintMockup.state.parts[0].remaining)).toBe(3);
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `cd fabrication_pro_capacitor && npx playwright test tests/e2e/blueprint-builder.spec.mjs --project=desktop-chromium -g "rotation|quantity|drag"`

Expected: FAIL because edit APIs and pointer interactions are not implemented.

- [ ] **Step 3: Implement pointer interactions and editing APIs**

Use Pointer Events so mouse and touch share one path. Drawer drag should create a ghost preview, convert screen coordinates to model inches, and call validated placement only on release. Member drag changes only the two coordinates visible in the active view; hidden coordinate remains unchanged.

`rotateMemberInView` toggles only the active view's axis pair. Reject a rotation if the resulting full member envelope leaves workspace bounds. `rotateMemberFace` toggles `roll` between 0 and 90 for 2 x 6 only. `deleteMember` removes the member and returns one source quantity.

- [ ] **Step 4: Run the focused interaction tests**

Run: `cd fabrication_pro_capacitor && npx playwright test tests/e2e/blueprint-builder.spec.mjs --project=desktop-chromium -g "rotation|quantity|drag"`

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add fabrication_pro_capacitor/mockups/blueprint-builder.html fabrication_pro_capacitor/tests/e2e/blueprint-builder.spec.mjs
git commit -m "feat: add blueprint member editing interactions"
```

### Task 4: 3D-aware snapping, placement bounds, zoom, pan, and fit

**Files:**
- Modify: `fabrication_pro_capacitor/mockups/blueprint-builder.html`
- Modify: `fabrication_pro_capacitor/tests/e2e/blueprint-builder.spec.mjs`

**Interfaces:**
- Consumes: member model and projection math.
- Produces: `snapCandidate(candidate, movingMember, view)`, `memberFitsWorkspace(member)`, `setZoom(nextZoom, anchor?)`, `fitView()`, `viewport` state, and visible `.snap-guide` / `.invalid-preview` states.

- [ ] **Step 1: Add failing tests for physical snapping and bounds**

Create two members whose projections overlap but whose hidden coordinates differ, and assert no object snap occurs. Then align hidden coordinates and assert endpoint snap occurs:

```js
const result = await page.evaluate(() => {
  const api = window.BlueprintMockup;
  return api.debugSnapProbe({ view: 'top', moving: { x: 47, y: 12, z: 0, axis: 'x', length: 24 }, targetMemberId: api.state.members[0].id });
});
expect(result.type).toBe('endpoint');
```

Add a second probe with the target at another elevation and expect `grid`, not `endpoint`. Add an out-of-bounds placement assertion expecting `placeMember` to return `null` and leave quantity unchanged.

- [ ] **Step 2: Run snapping/bounds tests and verify failure**

Run: `cd fabrication_pro_capacitor && npx playwright test tests/e2e/blueprint-builder.spec.mjs --project=desktop-chromium -g "snap|bounds"`

Expected: FAIL because 3D-aware snap probing and envelope validation are incomplete.

- [ ] **Step 3: Implement snapping and envelope validation**

Grid-snap visible coordinates to whole inches first. Then search valid object snap targets. Endpoint snaps require all three physical coordinates to agree within the snap tolerance after applying the candidate. Edge/centerline snaps are valid only where the target segment intersects the active placement plane. Never snap based solely on 2D projection overlap.

Validate the complete tube envelope, not only its centerline. Render an obvious but restrained invalid preview when bounds fail. Render a subtle snap marker at the accepted target.

- [ ] **Step 4: Add failing zoom/fit assertions**

```js
const before = await page.evaluate(() => ({ ...window.BlueprintMockup.state.members[0] }));
await page.getByRole('button', { name: 'Zoom In' }).click();
await page.getByRole('button', { name: 'Fit' }).click();
const after = await page.evaluate(() => ({ ...window.BlueprintMockup.state.members[0] }));
expect(after).toEqual(before);
await expect(page.locator('#zoom-label')).toContainText('%');
```

- [ ] **Step 5: Implement viewport transform controls**

Keep viewport state separate from member model:

```js
const viewport = { zoom: 1, panX: 0, panY: 0 };
```

Implement Zoom Out, Zoom In, percentage label, Fit, wheel zoom around the pointer where practical, and empty-grid drag-to-pan. Clamp zoom to a practical prototype range such as 25% to 800%. Grid visibility should adapt to zoom without changing inch coordinates.

- [ ] **Step 6: Run focused snapping and viewport tests**

Run: `cd fabrication_pro_capacitor && npx playwright test tests/e2e/blueprint-builder.spec.mjs --project=desktop-chromium -g "snap|bounds|zoom|fit"`

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add fabrication_pro_capacitor/mockups/blueprint-builder.html fabrication_pro_capacitor/tests/e2e/blueprint-builder.spec.mjs
git commit -m "feat: add blueprint snapping and viewport controls"
```

### Task 5: Responsive polish and full regression verification

**Files:**
- Modify: `fabrication_pro_capacitor/mockups/blueprint-builder.html`
- Modify: `fabrication_pro_capacitor/tests/e2e/blueprint-builder.spec.mjs`

**Interfaces:**
- Consumes: complete mockup.
- Produces: mobile drawer behavior and `@mobile` regression coverage.

- [ ] **Step 1: Add a failing mobile usability test**

```js
test('@mobile blueprint controls remain usable at phone width', async ({ page }) => {
  await page.goto(mockupUrl);
  await expect(page.getByRole('button', { name: 'Parts' })).toBeVisible();
  await expect(page.locator('#blueprint-svg')).toBeVisible();
  const box = await page.locator('#blueprint-svg').boundingBox();
  expect(box.width).toBeGreaterThan(300);
});
```

- [ ] **Step 2: Run the mobile test and verify failure if the layout is not yet suitable**

Run: `cd fabrication_pro_capacitor && npx playwright test tests/e2e/blueprint-builder.spec.mjs --project=mobile-chromium`

Expected before polish: at least one mobile layout assertion fails.

- [ ] **Step 3: Implement responsive layout polish**

At narrow widths, make the parts collection a collapsible overlay/drawer, keep Top / Wall A / Wall B and Placement Plane controls reachable without horizontal page scrolling, preserve large touch targets, and give most viewport height to the SVG drafting surface.

- [ ] **Step 4: Run the complete Blueprint Builder spec**

Run: `cd fabrication_pro_capacitor && npx playwright test tests/e2e/blueprint-builder.spec.mjs`

Expected: all desktop and mobile Blueprint Builder tests PASS.

- [ ] **Step 5: Run existing app verification to prove production isolation**

Run: `cd fabrication_pro_capacitor && npm run verify`

Expected: PASS with no production-app regressions.

Run: `cd fabrication_pro_capacitor && npm run test:e2e`

Expected: PASS, including the new mockup coverage and all pre-existing E2E tests.

- [ ] **Step 6: Confirm release metadata remains unchanged**

Run: `cd fabrication_pro_capacitor && node -e "const p=require('./package.json'); if(p.version!=='1.0.8'||p.name!=='fabri-cadabra-capacitor') process.exit(1); console.log(p.name,p.version)"`

Expected: `fabri-cadabra-capacitor 1.0.8`.

- [ ] **Step 7: Commit final mockup polish**

```bash
git add fabrication_pro_capacitor/mockups/blueprint-builder.html fabrication_pro_capacitor/tests/e2e/blueprint-builder.spec.mjs
git commit -m "test: verify blueprint builder mockup"
```
