import { describe, it, expect } from 'vitest';
import { isValidUrl, isValidImageUrl } from './url-utils';

describe('isValidUrl', () => {
  it('accepts absolute http and https URLs', () => {
    expect(isValidUrl('https://example.com/a.png')).toBe(true);
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('rejects relative paths, which have no origin to resolve against', () => {
    expect(isValidUrl('/ar/abc-123')).toBe(false);
    expect(isValidUrl('example.com')).toBe(false);
  });

  it('rejects empty and non-string input', () => {
    expect(isValidUrl('')).toBe(false);
    // @ts-expect-error guarding the runtime path callers actually hit
    expect(isValidUrl(null)).toBe(false);
    // @ts-expect-error same
    expect(isValidUrl(undefined)).toBe(false);
  });

  it('accepts any parseable scheme — it validates syntax, not safety', () => {
    // Worth knowing: this returns true. Callers that need a safe URL must use
    // isValidImageUrl, which is the one that checks the protocol.
    expect(isValidUrl('javascript:alert(1)')).toBe(true);
  });
});

describe('isValidImageUrl', () => {
  it('accepts the Supabase storage URLs this app actually serves', () => {
    expect(
      isValidImageUrl('https://qllfquoqrxvfgdudnrrr.supabase.co/storage/v1/object/sign/postcard-images/a.png?token=x')
    ).toBe(true);
  });

  it('accepts http, https and data URLs', () => {
    expect(isValidImageUrl('http://example.com/a.png')).toBe(true);
    expect(isValidImageUrl('https://example.com/a.png')).toBe(true);
    expect(isValidImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('rejects dangerous schemes', () => {
    expect(isValidImageUrl('javascript:alert(1)')).toBe(false);
    expect(isValidImageUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects relative and empty input', () => {
    expect(isValidImageUrl('/images/a.png')).toBe(false);
    expect(isValidImageUrl('')).toBe(false);
  });

  it('KNOWN GAP: accepts data:text/html, which is not an image', () => {
    // The protocol check allows any data: URL, so an HTML payload passes a
    // function named "isValidImageUrl". Harmless where the result only feeds
    // an <img> src, but this must not be reused as a general safety check.
    // Tighten to data:image/ if this ever guards anything else.
    expect(isValidImageUrl('data:text/html,<script>alert(1)</script>')).toBe(true);
  });
});
