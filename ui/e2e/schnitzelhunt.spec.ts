import { test, expect } from '@playwright/test'

test.skip('should navigate to the game screen', async ({ page }) => {
  // Go to start page
  await page.goto('http://localhost:3000')

  // shows intro screen components
  await expect(page.locator('h1')).toContainText('zk schnitzelhunt')
  await expect(page.locator('button')).toContainText('START NEW GAME');

  // click start game button and go to game screen
  await page.locator('button').click()
  await expect(page).toHaveURL('http://localhost:3000/game')
  await expect(page.locator('[data-testid=riddle1]')).toContainText('I\'ve got an anchor, but have no sail. My sound makes Hooks\' mind derail. Stand underneath, close in the middle, share your location to solve this riddle.')
})

test('should be able to play the game successfully', async ({ page, context }) => {
  // Go to game page 
  await page.goto('http://localhost:3000/game')
  let coords = { latitude: 48.2107958217, longitude: 16.3736155926 };
  context.setGeolocation(coords);

  // solving first riddle correctly
  await page.locator('svg[data-icon="location-dot"]').click()

  await expect(page.locator('[data-testid=location]')).toContainText('48.2107958217')
  await expect(page.locator('[data-testid=location]')).toContainText('16.3736155926')

  await page.locator('[data-testid=submit-location]').click()

  await page.locator('svg[data-icon="arrow-right"]').click()

  // solving 2nd riddle correctly 
  coords = { latitude: 48.2079410492, longitude: 16.3716678382 };
  context.setGeolocation(coords);

  await page.locator('svg[data-icon="location-dot"]').click()

  await expect(page.locator('[data-testid=location]')).toContainText('48.2079410492')
  await expect(page.locator('[data-testid=location]')).toContainText('16.3716678382')

  await page.locator('[data-testid=submit-location]').click()

  await page.locator('svg[data-icon="arrow-right"]').click()

  // solving 3rd riddle correctly 
  coords = { latitude: 48.2086269882, longitude: 16.3725081062 };
  context.setGeolocation(coords);

  await page.locator('svg[data-icon="location-dot"]').click()

  await expect(page.locator('[data-testid=location]')).toContainText('48.2086269882')
  await expect(page.locator('[data-testid=location]')).toContainText('16.3725081062')

  await page.locator('[data-testid=submit-location]').click()

  await expect(page.locator('[data-testid=finished-message]')).toContainText('Congrats! You successfully hunted the Schnitzel!')

})