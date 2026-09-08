import { describe, it, expect, afterEach, vi } from 'vitest';
import { buildArExperienceUrl } from './qr-overlay';

/**
 * These assertions guard a physical artifact.
 *
 * buildArExperienceUrl produces the URL that gets encoded into the QR code
 * printed on a postcard. Once a card is printed, that string cannot be
 * changed — only redirected. So the shape /ar/<id> is a contract, and any
 * port that quietly alters it breaks every card already in someone's hands.
 */
describe('buildArExperienceUrl', () => {
  const originalEnv = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalEnv;
    vi.unstubAllGlobals();
  });

  it('builds /ar/<id> from the configured app URL on the server', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
    expect(buildArExperienceUrl('abc-123')).toBe('https://example.com/ar/abc-123');
  });

  it('strips trailing slashes so the path never doubles up', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com///';
    expect(buildArExperienceUrl('abc-123')).toBe('https://example.com/ar/abc-123');
  });

  it('falls back to the production host when no app URL is configured', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(buildArExperienceUrl('abc-123')).toBe('https://regaliz.vercel.app/ar/abc-123');
  });

  it('prefers the current origin in the browser', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://ignored.example';
    vi.stubGlobal('window', { location: { origin: 'https://pastello.test' } });
    expect(buildArExperienceUrl('abc-123')).toBe('https://pastello.test/ar/abc-123');
  });

  it('keeps the id verbatim, including UUIDs', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
    const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    expect(buildArExperienceUrl(uuid)).toBe(`https://example.com/ar/${uuid}`);
  });
});
