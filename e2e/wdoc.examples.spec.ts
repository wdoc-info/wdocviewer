import { test, expect } from '@playwright/test';
import path from 'path';

const examplesDir = path.resolve(__dirname, '../examples');

async function loadExample(page, name: string) {
  const wdoc = path.join(examplesDir, `${name}.wdoc`);
  await page.locator('input[type=file]').setInputFiles(wdoc);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('hello_world example renders', async ({ page }) => {
  await loadExample(page, 'hello_world');
  await expect(page.locator('h1')).toHaveText('Hello, World!');
});

test('internal_script example strips scripts', async ({ page }) => {
  await loadExample(page, 'internal_script');
  await expect(page.locator('h1')).toHaveText('Internal script');
  await expect(page.locator('wdoc-container script')).toHaveCount(0);
});

test('already_paginated keeps pages', async ({ page }) => {
  await loadExample(page, 'already_paginated');
  await expect(page.locator('wdoc-page')).toHaveCount(2);
});

test('internal_image example embeds images', async ({ page }) => {
  await loadExample(page, 'internal_image');
  const src = await page.locator('img').getAttribute('src');
  expect(src).toMatch(/^data:image\//);
});

test('external_image example loads after confirm', async ({ page }) => {
  page.once('dialog', (dialog) => dialog.accept());
  await loadExample(page, 'external_image');
  await expect(page.locator('img')).toHaveAttribute('src', /logo.png/);
});

test('overflowing_text paginates content', async ({ page }) => {
  await loadExample(page, 'overflowing_text');
  const count = await page.locator('wdoc-page').count();
  expect(count).toBeGreaterThan(1);
});

test('form example displays form', async ({ page }) => {
  await loadExample(page, 'form');
  await expect(page.locator('form')).toHaveCount(1);
});

test('image_changed example warns about signature mismatch', async ({ page }) => {
  const dialogPromise = page.waitForEvent('dialog');
  await loadExample(page, 'image_changed');
  const dialog = await dialogPromise;
  expect(dialog.message()).toContain('does not match its manifest');
  await dialog.dismiss();
  await expect(page.locator('wdoc-container')).toHaveCount(0);
});
