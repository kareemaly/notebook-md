import path from 'node:path';

/**
 * Per-project include/exclude filtering based on path prefixes.
 *
 * Patterns are path prefixes relative to the project root, written with
 * POSIX separators. "memory" matches the file "memory/a.md" and the
 * directory "memory/sub". No glob syntax — a pattern is an ancestor
 * match on path segments. Leading and trailing slashes are ignored.
 *
 * Semantics (for files):
 *  - If any `exclude` pattern is an ancestor of the file → rejected.
 *  - Otherwise, if `include` is empty/undefined → accepted.
 *  - Otherwise, accepted iff some `include` pattern is an ancestor.
 *
 * Semantics (for directories, i.e. "can this dir contain a match?"):
 *  - Same exclude rule.
 *  - If `include` is empty → yes.
 *  - Otherwise yes iff the dir is an ancestor of an include prefix
 *    OR an include prefix is an ancestor of the dir (we're inside it).
 */

function normalize(rel: string): string {
  // Convert to POSIX separators and strip leading/trailing slashes.
  return rel.split(path.sep).join('/').replace(/^\/+|\/+$/g, '');
}

function normalizePatterns(patterns: string[] | undefined): string[] {
  if (!patterns) return [];
  return patterns.map(normalize).filter((p) => p.length > 0);
}

/** True if `ancestor` is an ancestor of `descendant`, or equal. */
function isAncestorOrEqual(ancestor: string, descendant: string): boolean {
  if (ancestor === '') return true;
  return descendant === ancestor || descendant.startsWith(ancestor + '/');
}

export interface PathFilter {
  /** Whether a supported file at `relFile` should be exposed. */
  acceptsFile(relFile: string): boolean;
  /** Whether the walker should descend into the directory at `relDir`. */
  acceptsDir(relDir: string): boolean;
  /** True if the filter is a no-op (no include/exclude configured). */
  readonly isIdentity: boolean;
}

export function createPathFilter(
  include: string[] | undefined,
  exclude: string[] | undefined,
): PathFilter {
  const includes = normalizePatterns(include);
  const excludes = normalizePatterns(exclude);
  const hasIncludes = includes.length > 0;
  const hasExcludes = excludes.length > 0;
  const isIdentity = !hasIncludes && !hasExcludes;

  function isExcluded(rel: string): boolean {
    if (!hasExcludes) return false;
    return excludes.some((e) => isAncestorOrEqual(e, rel));
  }

  return {
    isIdentity,
    acceptsFile(relFile: string): boolean {
      const rel = normalize(relFile);
      if (isExcluded(rel)) return false;
      if (!hasIncludes) return true;
      return includes.some((i) => isAncestorOrEqual(i, rel));
    },
    acceptsDir(relDir: string): boolean {
      const rel = normalize(relDir);
      if (isExcluded(rel)) return false;
      if (!hasIncludes) return true;
      if (rel === '') return true; // the project root is always walkable
      // Either we're inside an include prefix, or an include prefix is
      // inside us (we're on the path down to it).
      return includes.some(
        (i) => isAncestorOrEqual(i, rel) || isAncestorOrEqual(rel, i),
      );
    },
  };
}
