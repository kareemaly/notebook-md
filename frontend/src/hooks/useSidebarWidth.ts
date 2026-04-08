import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'notebook.sidebarWidth';
const DEFAULT_WIDTH = 256;
const MIN_WIDTH = 180;
const MAX_WIDTH = 560;

function clamp(w: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w));
}

function readStoredWidth(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_WIDTH;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_WIDTH;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? clamp(parsed) : DEFAULT_WIDTH;
}

/**
 * Manages the sidebar width with localStorage persistence and a drag
 * handler meant to be bound to a vertical resize grip on the right
 * edge of the sidebar. Uses pointer capture so the drag keeps tracking
 * even if the cursor leaves the handle element.
 */
export function useSidebarWidth() {
  const [width, setWidth] = useState<number>(readStoredWidth);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width));
  }, [width]);

  // Visually communicate that a drag is in progress by flipping the
  // global cursor and disabling text selection while the pointer is down.
  useEffect(() => {
    if (!dragging) return;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [dragging]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      startX.current = e.clientX;
      startWidth.current = width;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [width],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const delta = e.clientX - startX.current;
    setWidth(clamp(startWidth.current + delta));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
  }, []);

  // Double-click the handle to reset to the default width — a common
  // convention in IDE-style resizable panels.
  const onDoubleClick = useCallback(() => {
    setWidth(DEFAULT_WIDTH);
  }, []);

  // Keyboard-adjust the width when the grip has focus. Left/right
  // shrink/grow by 8px (32px with Shift). Home/End snap to min/max.
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 32 : 8;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setWidth((w) => clamp(w - step));
        break;
      case 'ArrowRight':
        e.preventDefault();
        setWidth((w) => clamp(w + step));
        break;
      case 'Home':
        e.preventDefault();
        setWidth(MIN_WIDTH);
        break;
      case 'End':
        e.preventDefault();
        setWidth(MAX_WIDTH);
        break;
    }
  }, []);

  return {
    width,
    dragging,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onDoubleClick,
      onKeyDown,
      role: 'separator' as const,
      'aria-orientation': 'vertical' as const,
      'aria-label': 'Resize sidebar',
      'aria-valuemin': MIN_WIDTH,
      'aria-valuemax': MAX_WIDTH,
      'aria-valuenow': width,
      tabIndex: 0,
    },
  };
}
