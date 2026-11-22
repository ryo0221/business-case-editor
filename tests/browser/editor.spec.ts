import { expect, test } from '@playwright/test';
test('収支の前提とシナリオ比較を表示し、保存後に開き直す', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('table')).toHaveCount(2);
  await expect(page.getByRole('table').first()).toContainText('年間売上');
  await expect(page.getByRole('table').nth(1)).toContainText('641127690');
  await expect(page.getByRole('table').nth(1)).toContainText('18.0912%');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.locator('#status')).toHaveText('保存しました。');
  await page.reload();
  await expect(page.getByRole('table').nth(1)).toContainText('641127690');
});
