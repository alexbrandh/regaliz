import { describe, it, expect } from 'vitest';
import { validateUUID, validateUserId, validateNFTDescriptors } from './validation';

describe('validateUUID', () => {
  it('accepts a v4 UUID', () => {
    expect(validateUUID('3f2504e0-4f89-41d3-9a0c-0305e82c3301').isValid).toBe(true);
  });

  it('is case insensitive', () => {
    expect(validateUUID('3F2504E0-4F89-41D3-9A0C-0305E82C3301').isValid).toBe(true);
  });

  it('rejects other UUID versions', () => {
    // v1: the version nibble is 1, not 4
    expect(validateUUID('3f2504e0-4f89-11d3-9a0c-0305e82c3301').isValid).toBe(false);
  });

  it('rejects a malformed or empty value', () => {
    for (const bad of ['', 'not-a-uuid', '3f2504e0-4f89-41d3-9a0c']) {
      expect(validateUUID(bad).isValid).toBe(false);
    }
  });

  it('names the offending field in its error', () => {
    const result = validateUUID('nope', 'postcardId');
    expect(result.isValid).toBe(false);
    expect(result.errors[0].field).toBe('postcardId');
  });
});

/**
 * validateUserId is the seam the port has to be careful with.
 *
 * postcards.user_id is a TEXT column holding two different shapes: real
 * Supabase UUIDs, and legacy `user_*` ids left over from when this app ran on
 * Clerk. Those legacy rows are still in the database and still own storage
 * folders named after them.
 *
 * Migrating the column to a UUID foreign key means dealing with them
 * deliberately. These assertions pin down today's behaviour so that decision
 * is made on purpose rather than discovered in production.
 */
describe('validateUserId', () => {
  it('accepts a Supabase UUID', () => {
    expect(validateUserId('3f2504e0-4f89-41d3-9a0c-0305e82c3301').isValid).toBe(true);
  });

  it('still accepts legacy Clerk-style ids', () => {
    expect(validateUserId('user_2abcDEF123').isValid).toBe(true);
  });

  it('rejects a user_ prefix with nothing after it', () => {
    expect(validateUserId('user_').isValid).toBe(false);
  });

  it('rejects non-alphanumeric characters after the prefix', () => {
    expect(validateUserId('user_abc-def').isValid).toBe(false);
  });

  it('rejects anything that is neither shape', () => {
    for (const bad of ['', 'admin', '12345']) {
      expect(validateUserId(bad).isValid).toBe(false);
    }
  });
});

/**
 * Guards the legacy AR.js descriptor shape, produced by /api/nft/generate.
 * Note this is NOT the shape the live MindAR pipeline writes — that one is
 * {type: 'mindar', targetUrl, ...} and never passes through here.
 */
describe('validateNFTDescriptors', () => {
  const valid = {
    descriptorUrl: 'https://example.com/descriptors',
    generated: true,
    timestamp: '2026-01-01T00:00:00.000Z',
    files: {
      iset: 'https://example.com/d.iset',
      fset: 'https://example.com/d.fset',
      fset3: 'https://example.com/d.fset3',
    },
  };

  it('accepts a complete descriptor set', () => {
    expect(validateNFTDescriptors(valid).isValid).toBe(true);
  });

  it('rejects non-objects', () => {
    for (const bad of [null, undefined, 'string', 42]) {
      expect(validateNFTDescriptors(bad).isValid).toBe(false);
    }
  });

  it('requires every one of the three marker files', () => {
    for (const missing of ['iset', 'fset', 'fset3'] as const) {
      const files = { ...valid.files };
      delete files[missing];
      const result = validateNFTDescriptors({ ...valid, files });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === `files.${missing}`)).toBe(true);
    }
  });

  it('rejects file entries that are not URLs strings', () => {
    const result = validateNFTDescriptors({
      ...valid,
      files: { ...valid.files, fset: 12345 },
    });
    expect(result.isValid).toBe(false);
  });

  it('reports every missing top-level field at once, not just the first', () => {
    const result = validateNFTDescriptors({ files: valid.files });
    expect(result.isValid).toBe(false);
    const missing = result.errors.map((e) => e.field);
    expect(missing).toContain('descriptorUrl');
    expect(missing).toContain('generated');
    expect(missing).toContain('timestamp');
  });

  it('does NOT accept the live MindAR descriptor shape', () => {
    // Documents a real split: /api/ar/compile-target writes this shape into
    // the same nft_descriptors column, and it would fail this validator. It
    // never reaches it today because only the legacy route calls this.
    const mindar = {
      type: 'mindar',
      targetUrl: '/api/ar/mind-target/user/postcard',
      generatedBy: 'mindar-server',
    };
    expect(validateNFTDescriptors(mindar).isValid).toBe(false);
  });
});
