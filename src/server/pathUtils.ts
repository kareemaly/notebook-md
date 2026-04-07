import path from 'node:path';

/**
 * Resolves a raw client-supplied path against a project root, applying
 * traversal-prevention and extension filtering.
 *
 * Returns the absolute path if safe and valid, or null if:
 * - the path escapes the project root (directory traversal)
 * - the resolved file is not a .md file
 * - rawPath is empty or falsy
 */
export function resolveSafePath(projectRoot: string, rawPath: string): string | null {
  if (!rawPath) return null;

  // 1. Reject null bytes — they are always invalid in file paths
  if (rawPath.includes('\0')) return null;

  // 2. Decode percent-encoded characters (e.g. %2F → /) before resolving
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }

  // Reject null bytes that may have been percent-encoded
  if (decoded.includes('\0')) return null;

  // 3. Resolve to an absolute path anchored at the project root
  const resolved = path.resolve(projectRoot, decoded);

  // 4. Guard against directory traversal: resolved must be inside projectRoot
  const rootWithSep = projectRoot.endsWith(path.sep) ? projectRoot : projectRoot + path.sep;
  if (resolved !== projectRoot && !resolved.startsWith(rootWithSep)) {
    return null;
  }

  // 5. Only .md files are served
  if (path.extname(resolved).toLowerCase() !== '.md') {
    return null;
  }

  return resolved;
}
