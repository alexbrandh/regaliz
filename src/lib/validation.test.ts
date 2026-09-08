import { describe, it, expect } from 'vitest';
import { validateUUID, validateUserId } from './validation';

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
