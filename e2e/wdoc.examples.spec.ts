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
  await expect(page.locator('script')).toHaveCount(0);
});

test('already_paginated keeps pages', async ({ page }) => {
  await loadExample(page, 'already_paginated');
  await expect(page.locator('wdoc-page')).toHaveCount(2);
});
