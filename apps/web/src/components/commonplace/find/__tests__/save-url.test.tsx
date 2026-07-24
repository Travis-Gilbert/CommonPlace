// @vitest-environment jsdom

/**
 * One-click save acceptance (SPEC F4): the toolbar button and the keystroke both
 * call saveUrl on the current page, and the confirmation names the REAL
 * collection from the receipt. A missing receipt renders an explicit error, not
 * a placeholder collection name.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));

const client = vi.hoisted(() => ({ saveUrl: vi.fn() }));
vi.mock('@/lib/search-stack/client', () => client);

import { SaveUrlButton, savedConfirmation } from '../SaveUrlButton';
import { fixtureSaveUrl, FIXTURE_COLLECTION_NAME } from '@/lib/search-stack/fixtures';

const PAGE_URL = 'https://example.com/budget-discipline';

beforeEach(() => {
  client.saveUrl.mockReset();
  toasts.success.mockReset();
  toasts.error.mockReset();
});

afterEach(cleanup);

describe('the save affordance', () => {
  it('calls saveUrl with the page on the stage when the button is pressed', async () => {
    client.saveUrl.mockResolvedValue(fixtureSaveUrl(PAGE_URL));
    render(<SaveUrlButton url={PAGE_URL} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save this page' }));
    });
    await waitFor(() => expect(client.saveUrl).toHaveBeenCalledWith(PAGE_URL));
  });

  it('calls saveUrl on the keystroke as well as the button', async () => {
    client.saveUrl.mockResolvedValue(fixtureSaveUrl(PAGE_URL));
    render(<SaveUrlButton url={PAGE_URL} />);
    await act(async () => {
      fireEvent.keyDown(document, { key: 's', code: 'KeyS', metaKey: true, ctrlKey: true });
    });
    await waitFor(() => expect(client.saveUrl).toHaveBeenCalledWith(PAGE_URL));
  });

  it('confirms with the real collection name from the receipt', async () => {
    const receipt = { ...fixtureSaveUrl(PAGE_URL), collectionName: 'Field notes, June' };
    client.saveUrl.mockResolvedValue(receipt);
    render(<SaveUrlButton url={PAGE_URL} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save this page' }));
    });
    await waitFor(() => expect(toasts.success).toHaveBeenCalled());
    const [message] = toasts.success.mock.calls[0] as [string, unknown];
    expect(message).toBe('Saved to Field notes, June');
    expect(message).toContain(receipt.collectionName);
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('hands the receipt to the caller so it can land in the rail', async () => {
    const receipt = fixtureSaveUrl(PAGE_URL);
    client.saveUrl.mockResolvedValue(receipt);
    const onSaved = vi.fn();
    render(<SaveUrlButton url={PAGE_URL} onSaved={onSaved} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save this page' }));
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(receipt));
    expect(receipt.collectionName).toBe(FIXTURE_COLLECTION_NAME);
  });

  it('renders an explicit error when the receipt is missing, never a placeholder', async () => {
    client.saveUrl.mockResolvedValue(undefined);
    render(<SaveUrlButton url={PAGE_URL} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save this page' }));
    });
    await waitFor(() => expect(toasts.error).toHaveBeenCalled());
    const [message] = toasts.error.mock.calls[0] as [string];
    expect(message).toContain('Save failed');
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('renders an explicit error when the receipt carries no collection name', async () => {
    client.saveUrl.mockResolvedValue({ ...fixtureSaveUrl(PAGE_URL), collectionName: '' });
    render(<SaveUrlButton url={PAGE_URL} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save this page' }));
    });
    await waitFor(() => expect(toasts.error).toHaveBeenCalled());
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('is inert when the stage has no page to save', () => {
    render(<SaveUrlButton url="https://" />);
    const button = screen.getByRole('button', { name: 'Save this page' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(client.saveUrl).not.toHaveBeenCalled();
  });

  it('words the confirmation from the receipt alone', () => {
    expect(savedConfirmation(fixtureSaveUrl(PAGE_URL))).toBe(`Saved to ${FIXTURE_COLLECTION_NAME}`);
  });
});
