import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { searchWithFallback } from '../src/search/fallback.js';

// Tests use a real temp directory to avoid mocking fs complexity.
// ripgrep availability varies across environments, so we only test the JS fallback.

const PROJECT_ID = 'test-project';

describe('searchWithFallback — filename mode', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notebook-test-'));
    fs.writeFileSync(path.join(tmpDir, 'meeting-notes.md'), '# Meeting\nSome content');
    fs.writeFileSync(path.join(tmpDir, 'todo.md'), '# Todo\n- item 1');
    fs.writeFileSync(path.join(tmpDir, 'README.txt'), 'not markdown'); // should be ignored
    fs.mkdirSync(path.join(tmpDir, 'sub'));
    fs.writeFileSync(path.join(tmpDir, 'sub', 'deep-meeting.md'), '# Deep');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('finds files matching the query by name', async () => {
    const results = await searchWithFallback(tmpDir, PROJECT_ID, 'meeting', 'filename');
    const paths = results.map((r) => r.filePath);
    expect(paths).toContain('meeting-notes.md');
    expect(paths).toContain(path.join('sub', 'deep-meeting.md'));
    expect(paths).not.toContain('todo.md');
  });

  it('returns empty array when no files match', async () => {
    const results = await searchWithFallback(tmpDir, PROJECT_ID, 'xyzzy', 'filename');
    expect(results).toHaveLength(0);
  });

  it('is case-insensitive', async () => {
    const results = await searchWithFallback(tmpDir, PROJECT_ID, 'MEETING', 'filename');
    expect(results.length).toBeGreaterThan(0);
  });

  it('never returns non-.md files', async () => {
    const results = await searchWithFallback(tmpDir, PROJECT_ID, 'README', 'filename');
    // README.txt exists but should not appear
    expect(results.find((r) => r.filePath.endsWith('.txt'))).toBeUndefined();
  });
});

describe('searchWithFallback — content mode', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notebook-test-'));
    fs.writeFileSync(
      path.join(tmpDir, 'alpha.md'),
      ['line 1', 'this has KEYWORD here', 'line 3'].join('\n'),
    );
    fs.writeFileSync(
      path.join(tmpDir, 'beta.md'),
      ['other content', 'no match here', 'also nothing'].join('\n'),
    );
    fs.writeFileSync(
      path.join(tmpDir, 'gamma.md'),
      ['start', 'KEYWORD appears twice', 'middle', 'and KEYWORD again', 'end'].join('\n'),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('finds matching lines in files', async () => {
    const results = await searchWithFallback(tmpDir, PROJECT_ID, 'KEYWORD', 'content');
    const matchingFiles = new Set(results.map((r) => r.filePath));
    expect(matchingFiles.has('alpha.md')).toBe(true);
    expect(matchingFiles.has('beta.md')).toBe(false);
    expect(matchingFiles.has('gamma.md')).toBe(true);
  });

  it('returns correct 1-based line numbers', async () => {
    const results = await searchWithFallback(tmpDir, PROJECT_ID, 'KEYWORD', 'content');
    const alphaResult = results.find((r) => r.filePath === 'alpha.md');
    expect(alphaResult?.line).toBe(2); // "this has KEYWORD here" is line 2
  });

  it('includes snippet with context lines', async () => {
    const results = await searchWithFallback(tmpDir, PROJECT_ID, 'KEYWORD', 'content');
    const alphaResult = results.find((r) => r.filePath === 'alpha.md');
    // Snippet should include the matching line and ±1 context line
    expect(alphaResult?.snippet).toContain('line 1'); // line before
    expect(alphaResult?.snippet).toContain('KEYWORD');
    expect(alphaResult?.snippet).toContain('line 3'); // line after
  });

  it('returns multiple results for a file with multiple matches', async () => {
    const results = await searchWithFallback(tmpDir, PROJECT_ID, 'KEYWORD', 'content');
    const gammaResults = results.filter((r) => r.filePath === 'gamma.md');
    expect(gammaResults).toHaveLength(2);
  });

  it('is case-insensitive', async () => {
    const results = await searchWithFallback(tmpDir, PROJECT_ID, 'keyword', 'content');
    expect(results.length).toBeGreaterThan(0);
  });
});
