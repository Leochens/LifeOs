import { test, expect } from '@playwright/test'

test.describe('Life-OS App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should load the app', async ({ page }) => {
    // Wait for the app to load
    await expect(page).toHaveTitle(/Life-OS/i)
  })

  test('should navigate between views', async ({ page }) => {
    // Click on the settings button/footer
    const settingsButton = page.locator('[aria-label="设置"], button:has-text("设置")').first()
    if (await settingsButton.isVisible()) {
      await settingsButton.click()
      await expect(page.locator('text=主题')).toBeVisible()
    }
  })

  test('should show dashboard by default', async ({ page }) => {
    // The dashboard should be visible on initial load
    await expect(page.locator('text=总览, text=Dashboard').first()).toBeVisible({ timeout: 10000 })
  })
})
