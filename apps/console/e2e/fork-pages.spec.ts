import { expect, test } from '@playwright/test';

test.describe('fork page architecture', () => {
  test('login renders a disabled provider state when GitHub is unconfigured', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in to CommonPlace' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'GitHub login is not configured' }),
    ).toBeDisabled();
    await expect(
      page.getByText('Login is unavailable. The control is disabled so it cannot start a broken authorization flow.'),
    ).toBeVisible();
  });

  test('signed-out onboarding, settings, and admin pages name their boundary', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page.getByRole('heading', { name: 'Create your first workspace' })).toBeVisible();
    await expect(page.getByText('Sign in before creating a workspace.')).toBeVisible();

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'CommonPlace settings' })).toBeVisible();
    await expect(
      page.getByText(
        'These settings configure identity, presentation, and desktop extensions. Model routing stays with the Harness.',
      ),
    ).toBeVisible();

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Instance identity' })).toBeVisible();
    await expect(page.getByText('Sign in to continue.')).toBeVisible();
  });

  test('workspace chat requires an active membership claim', async ({ page }) => {
    await page.goto('/workspace/research/chat');
    await expect(page.getByRole('heading', { name: 'Select this workspace' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'workspace settings' })).toHaveAttribute(
      'href',
      '/workspace/research/settings',
    );
  });

  test('view-instance routes are retired', async ({ page }) => {
    const response = await page.goto('/v/chat');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('404')).toBeVisible();
  });
});
