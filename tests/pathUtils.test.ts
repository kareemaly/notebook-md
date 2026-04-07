import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveSafePath } from '../src/server/pathUtils.js';

const ROOT = '/projects/my-notes';

describe('resolveSafePath', () => {
  it('returns null for empty string', () => {
    expect(resolveSafePath(ROOT, '')).toBeNull();
  });

  it('rejects obvious directory traversal', () => {
    expect(resolveSafePath(ROOT, '../../etc/passwd.md')).toBeNull();
  });

  it('rejects traversal that lands outside root even with .md extension', () => {
    expect(resolveSafePath(ROOT, '../secret.md')).toBeNull();
  });

  it('rejects percent-encoded traversal', () => {
    expect(resolveSafePath(ROOT, '..%2F..%2Fetc%2Fpasswd.md')).toBeNull();
  });

  it('rejects non-.md files', () => {
    expect(resolveSafePath(ROOT, 'notes.txt')).toBeNull();
    expect(resolveSafePath(ROOT, 'data.json')).toBeNull();
    expect(resolveSafePath(ROOT, 'script.js')).toBeNull();
  });

  it('accepts a top-level .md file', () => {
    const result = resolveSafePath(ROOT, 'README.md');
    expect(result).toBe(path.join(ROOT, 'README.md'));
  });

  it('accepts a deeply nested .md file', () => {
    const result = resolveSafePath(ROOT, 'a/b/c/notes.md');
    expect(result).toBe(path.join(ROOT, 'a', 'b', 'c', 'notes.md'));
  });

  it('accepts a file with a leading ./ prefix', () => {
    const result = resolveSafePath(ROOT, './README.md');
    expect(result).toBe(path.join(ROOT, 'README.md'));
  });

  it('rejects a path with null bytes', () => {
    // null byte in URIs is always invalid
    expect(resolveSafePath(ROOT, 'notes\0.md')).toBeNull();
  });
});
