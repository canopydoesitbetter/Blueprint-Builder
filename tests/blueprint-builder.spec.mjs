import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const mockupUrl = pathToFileURL(resolve('index.html')).href;

async function stagePart(page, { profile = '2x6', length = '76', qty = 3 } = {}) {
  await page.locator('#profile').selectOption(profile);
  await page.locator('#part-length').fill(String(length));
  await page.locator('#part-qty').fill(String(qty));
  await page.locator('#add-part').click();
}

test.beforeEach(async ({ page }) => {
  await page.goto(mockupUrl);
});

test('tube lengths are entered and displayed in inches only', async ({ page }) => {
  await expect(page.locator('#desktop-brand').getByText('Blueprint Builder', { exact: true })).toBeVisible();
  await expect(page.locator('#bp-width')).toHaveValue('20');
  await expect(page.locator('#bp-depth')).toHaveValue('20');
  await expect(page.locator('#bp-height')).toHaveValue('10');

  await expect(page.locator('label[for="part-length"]')).toHaveText('Length (in)');
  await expect(page.locator('#part-length')).toHaveAttribute('type', 'number');
  await expect(page.locator('#part-length')).toHaveValue('72');

  await stagePart(page);
  const row = page.locator('[data-part-id]').first();
  await expect(row).toContainText('2 x 6 x 1/8');
  await expect(row).toContainText('76"');
  await expect(row).not.toContainText("6'-4");
  await expect(row).toContainText('3 remaining');
});

test('shared member model stays synchronized across all four wall views', async ({ page }) => {
  await stagePart(page, { profile: '2x2', length: '48', qty: 2 });

  const model = await page.evaluate(() => {
    const api = window.BlueprintMockup;
    const part = api.state.parts[0];
    return api.placeMember(part.id, 'top', 24, 36);
  });

  expect(model).toMatchObject({ x: 24, y: 36, z: 0, axis: 'x', length: 48 });
  await expect(page.locator(`[data-member-id="${model.id}"]`)).toHaveCount(1);

  for (const view of ['wallA', 'wallB', 'wallC', 'wallD']) {
    await page.locator(`[data-view="${view}"]`).click();
    await expect(page.locator(`[data-member-id="${model.id}"]`)).toHaveCount(1);
  }
});

test('wall projections preserve the approved shared-edge orientation', async ({ page }) => {
  const edges = await page.evaluate(() => {
    const api = window.BlueprintMockup;
    const w = api.state.workspace.width;
    const d = api.state.workspace.depth;
    return {
      aLeft: api.projectPoint({ x: 0, y: 0, z: 0 }, 'wallA').u,
      aRight: api.projectPoint({ x: w, y: 0, z: 0 }, 'wallA').u,
      bRight: api.projectPoint({ x: 0, y: 0, z: 0 }, 'wallB').u,
      bLeft: api.projectPoint({ x: 0, y: d, z: 0 }, 'wallB').u,
      cRight: api.projectPoint({ x: 0, y: d, z: 0 }, 'wallC').u,
      cLeft: api.projectPoint({ x: w, y: d, z: 0 }, 'wallC').u,
      dRight: api.projectPoint({ x: w, y: d, z: 0 }, 'wallD').u,
      dLeft: api.projectPoint({ x: w, y: 0, z: 0 }, 'wallD').u,
    };
  });

  expect(edges.bRight).toBe(240);
  expect(edges.aLeft).toBe(0);
  expect(edges.cRight).toBe(240);
  expect(edges.bLeft).toBe(0);
  expect(edges.dRight).toBe(240);
  expect(edges.cLeft).toBe(0);
  expect(edges.aRight).toBe(240);
  expect(edges.dLeft).toBe(0);
});

test('Rotate Right cycles A to B to C to D to A', async ({ page }) => {
  await page.locator('[data-view="wallA"]').click();
  const sequence = [];
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Rotate Right' }).click();
    sequence.push(await page.evaluate(() => window.BlueprintMockup.state.view));
  }
  expect(sequence).toEqual(['wallB', 'wallC', 'wallD', 'wallA']);
});

test('Fit keeps a useful inspection margin around wall boundaries', async ({ page }) => {
  await page.locator('[data-view="wallA"]').click();
  const viewport = await page.evaluate(() => window.BlueprintMockup.state.viewport);
  expect(viewport.u).toBeLessThanOrEqual(-24);
  expect(viewport.w).toBeGreaterThanOrEqual(288);
});

test('rotation, 2x6 face roll, deletion, and quantity accounting stay consistent', async ({ page }) => {
  await stagePart(page, { profile: '2x6', length: '48', qty: 2 });

  const id = await page.evaluate(() => {
    const api = window.BlueprintMockup;
    const part = api.state.parts[0];
    return api.placeMember(part.id, 'top', 24, 24).id;
  });

  expect(await page.evaluate(() => window.BlueprintMockup.state.parts[0].remaining)).toBe(1);
  await expect(page.locator('#selection-label')).toContainText('48"');

  expect(await page.evaluate((memberId) => window.BlueprintMockup.rotateMemberInView(memberId, 'top'), id)).toBe(true);
  expect(await page.evaluate(() => window.BlueprintMockup.state.members[0].axis)).toBe('y');

  expect(await page.evaluate((memberId) => window.BlueprintMockup.rotateMemberFace(memberId), id)).toBe(true);
  expect(await page.evaluate(() => window.BlueprintMockup.state.members[0].roll)).toBe(90);

  expect(await page.evaluate((memberId) => window.BlueprintMockup.deleteMember(memberId), id)).toBe(true);
  expect(await page.evaluate(() => window.BlueprintMockup.state.parts[0].remaining)).toBe(2);
  await expect(page.locator('[data-member-id]')).toHaveCount(0);
});

test('out-of-bounds placement is rejected without consuming stock', async ({ page }) => {
  await stagePart(page, { profile: '3x3', length: '240', qty: 1 });

  const result = await page.evaluate(() => {
    const api = window.BlueprintMockup;
    const part = api.state.parts[0];
    return {
      member: api.placeMember(part.id, 'top', 12, 12),
      remaining: part.remaining,
      count: api.state.members.length,
    };
  });

  expect(result.member).toBeNull();
  expect(result.remaining).toBe(1);
  expect(result.count).toBe(0);
});

test('mobile-first shell gives the drafting canvas priority @mobile', async ({ page }) => {
  await expect(page.locator('#mobile-dock')).toBeVisible();
  await expect(page.locator('#desktop-brand')).toBeHidden();
  await expect(page.locator('#blueprint')).toBeVisible();

  const sizes = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    canvas: document.querySelector('#canvas-wrap').getBoundingClientRect(),
    topbar: document.querySelector('#mobile-topbar').getBoundingClientRect(),
    dock: document.querySelector('#mobile-dock').getBoundingClientRect(),
  }));

  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.width);
  expect(sizes.canvas.height).toBeGreaterThan(sizes.height * 0.55);
  expect(sizes.topbar.height).toBeLessThan(150);
  expect(sizes.dock.height).toBeLessThan(110);
});

test('mobile tools open as a bottom sheet instead of a desktop sidebar @mobile', async ({ page }) => {
  await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
  await page.locator('#drawer-btn').click();
  await expect(page.locator('#sidebar')).toHaveClass(/open/);
  await expect(page.locator('#sheet-backdrop')).toBeVisible();

  const sheet = await page.locator('#sidebar').evaluate((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { position: s.position, left: r.left, top: r.top, bottom: innerHeight - r.bottom, width: r.width, height: r.height };
  });

  expect(sheet.position).toBe('fixed');
  expect(sheet.bottom).toBeLessThanOrEqual(2);
  expect(sheet.width).toBeGreaterThan(300);
  expect(sheet.height).toBeLessThan(page.viewportSize().height * 0.78);
});

test('mobile dock switches between Parts, Tube, and Setup sheets @mobile', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Tube' }).click();
  await expect(page.locator('#sidebar')).toHaveClass(/open/);
  await expect(page.locator('[data-sheet-panel="tube"]')).toBeVisible();
  await expect(page.locator('[data-sheet-panel="parts"]')).toBeHidden();

  await page.getByRole('button', { name: 'Blueprint Setup' }).click();
  await expect(page.locator('[data-sheet-panel="setup"]')).toBeVisible();

  await page.getByRole('button', { name: 'Parts' }).click();
  await expect(page.locator('[data-sheet-panel="parts"]')).toBeVisible();
});

test('iPhone WebKit opens with safe-area-aware mobile controls @ios', async ({ page }) => {
  await expect(page.locator('#mobile-topbar')).toBeVisible();
  await expect(page.locator('#mobile-dock')).toBeVisible();
  await expect(page.locator('#view-tabs')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rotate Right' })).toBeVisible();
  await expect(page.locator('#blueprint')).toBeVisible();

  const meta = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(meta).toContain('viewport-fit=cover');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('desktop browser expands tools without losing the mobile-first canvas model', async ({ page }) => {
  await expect(page.locator('#desktop-brand')).toBeVisible();
  await expect(page.locator('#sidebar')).toBeVisible();
  await expect(page.locator('#mobile-dock')).toBeHidden();
  await expect(page.locator('#blueprint')).toBeVisible();

  const layout = await page.evaluate(() => ({
    width: innerWidth,
    sidebar: document.querySelector('#sidebar').getBoundingClientRect(),
    canvas: document.querySelector('#canvas-wrap').getBoundingClientRect(),
  }));

  expect(layout.sidebar.width).toBeGreaterThanOrEqual(300);
  expect(layout.canvas.width).toBeGreaterThan(layout.width * 0.5);
});
