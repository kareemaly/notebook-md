/**
 * Single source of truth for which file formats Notebook can render.
 *
 * Add new extensions here (e.g. '.mdx', '.markdown') and all of the
 * tree walker, watcher, search backends, and path guard will pick them
 * up automatically.
 */
export const SUPPORTED_EXTENSIONS = ['.md'] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

/** Ripgrep-style glob patterns, one per extension — `-g '*.md'` etc. */
export const SUPPORTED_GLOBS: readonly string[] = SUPPORTED_EXTENSIONS.map(
  (ext) => `*${ext}`,
);

/** True if `filename` has one of the supported extensions (case-insensitive). */
export function isSupportedFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
