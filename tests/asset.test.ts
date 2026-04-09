import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveSafeAssetPath } from '../src/server/pathUtils.js';

const ROOT = '/projects/my-notes';

// ---------------------------------------------------------------------------
// Unit tests for resolveSafeAssetPath
// ---------------------------------------------------------------------------

describe('resolveSafeAssetPath', () => {
  it('returns null for empty string', () => {
    expect(resolveSafeAssetPath(ROOT, '')).toBeNull();
  });

  it('rejects directory traversal', () => {
    expect(resolveSafeAssetPath(ROOT, '../../etc/passwd.jpg')).toBeNull();
  });

  it('rejects traversal that lands outside root even with allowed extension', () => {
    expect(resolveSafeAssetPath(ROOT, '../secret.png')).toBeNull();
  });

  it('rejects percent-encoded traversal', () => {
    expect(resolveSafeAssetPath(ROOT, '..%2F..%2Fetc%2Fshadow.jpg')).toBeNull();
  });

  it('rejects disallowed extensions', () => {
    expect(resolveSafeAssetPath(ROOT, 'notes.txt')).toBeNull();
    expect(resolveSafeAssetPath(ROOT, 'script.js')).toBeNull();
    expect(resolveSafeAssetPath(ROOT, 'README.md')).toBeNull();
    expect(resolveSafeAssetPath(ROOT, 'data.json')).toBeNull();
  });

  it('rejects null bytes', () => {
    expect(resolveSafeAssetPath(ROOT, 'image\0.png')).toBeNull();
    expect(resolveSafeAssetPath(ROOT, 'image%00.png')).toBeNull();
  });

  it('accepts top-level image files', () => {
    expect(resolveSafeAssetPath(ROOT, 'photo.png')).toBe(path.join(ROOT, 'photo.png'));
    expect(resolveSafeAssetPath(ROOT, 'diagram.svg')).toBe(path.join(ROOT, 'diagram.svg'));
    expect(resolveSafeAssetPath(ROOT, 'doc.pdf')).toBe(path.join(ROOT, 'doc.pdf'));
  });

  it('accepts all allowed extensions', () => {
    for (const ext of ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.pdf']) {
      expect(resolveSafeAssetPath(ROOT, `file${ext}`)).toBe(path.join(ROOT, `file${ext}`));
    }
  });

  it('accepts deeply nested asset paths', () => {
    const result = resolveSafeAssetPath(ROOT, 'assets/images/hero.webp');
    expect(result).toBe(path.join(ROOT, 'assets', 'images', 'hero.webp'));
  });

  it('accepts paths with leading ./', () => {
    expect(resolveSafeAssetPath(ROOT, './assets/photo.jpg')).toBe(
      path.join(ROOT, 'assets', 'photo.jpg'),
    );
  });

  it('is case-insensitive for extensions', () => {
    expect(resolveSafeAssetPath(ROOT, 'image.PNG')).toBe(path.join(ROOT, 'image.PNG'));
    expect(resolveSafeAssetPath(ROOT, 'photo.JPG')).toBe(path.join(ROOT, 'photo.JPG'));
  });
});

// ---------------------------------------------------------------------------
// Integration tests for the asset route
// ---------------------------------------------------------------------------

function get(
  port: number,
  urlPath: string,
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    http
      .get(`http://localhost:${port}${urlPath}`, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            statusCode: res.statusCode!,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }),
        );
      })
      .on('error', reject);
  });
}

describe('asset route', () => {
  let tmpDir: string;
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notebook-asset-test-'));

    const { createApp } = await import('../src/server/app.js');
    const configRef = {
      current: {
        port: 0,
        projects: [{ id: '0', name: 'test', path: tmpDir }],
        watcher: { maxDirs: 500 },
      },
    };
    const app = createApp(configRef as Parameters<typeof createApp>[0]);
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as { port: number }).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns 404 for unknown project', async () => {
    const res = await get(port, '/api/projects/999/asset?path=image.png');
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for path traversal', async () => {
    const res = await get(
      port,
      `/api/projects/0/asset?path=${encodeURIComponent('../../etc/passwd.jpg')}`,
    );
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for disallowed extension', async () => {
    fs.writeFileSync(path.join(tmpDir, 'secret.txt'), 'private');
    const res = await get(port, '/api/projects/0/asset?path=secret.txt');
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for a missing file', async () => {
    const res = await get(port, '/api/projects/0/asset?path=missing.png');
    expect(res.statusCode).toBe(404);
  });

  it('serves an SVG with correct Content-Type', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';
    fs.writeFileSync(path.join(tmpDir, 'icon.svg'), svg);
    const res = await get(port, '/api/projects/0/asset?path=icon.svg');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/svg\+xml/);
    expect(res.body.toString()).toBe(svg);
  });

  it('serves a PNG with correct Content-Type', async () => {
    // Minimal 1×1 transparent PNG (67 bytes)
    const png = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6260000000020001e221bc330000000049454e44ae426082',
      'hex',
    );
    fs.writeFileSync(path.join(tmpDir, 'pixel.png'), png);
    const res = await get(port, '/api/projects/0/asset?path=pixel.png');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
  });

  it('serves assets in subdirectories', async () => {
    fs.mkdirSync(path.join(tmpDir, 'assets'));
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    fs.writeFileSync(path.join(tmpDir, 'assets', 'logo.svg'), svg);
    const res = await get(
      port,
      `/api/projects/0/asset?path=${encodeURIComponent('assets/logo.svg')}`,
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/svg\+xml/);
  });
});
