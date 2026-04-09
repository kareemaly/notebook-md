import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock chokidar before importing the module under test
// ---------------------------------------------------------------------------

const fakeWatcherEmitter = new EventEmitter() as EventEmitter & {
  close: () => Promise<void>;
};
fakeWatcherEmitter.close = vi.fn(() => Promise.resolve());

vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => fakeWatcherEmitter),
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks are in place
// ---------------------------------------------------------------------------

import chokidar from 'chokidar';
import { WatcherManager } from '../src/watcher/index.js';

const MOCK_CONFIG = {
  port: 9001,
  projects: [{ id: '0', name: 'Test', path: '/tmp/test-project' }],
  watcher: { usePolling: false },
};

describe('WatcherManager debounce', () => {
  let manager: WatcherManager;

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset emitter listeners between tests
    fakeWatcherEmitter.removeAllListeners();
    manager = new WatcherManager({ current: MOCK_CONFIG });
  });

  afterEach(() => {
    manager.destroy();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('calls onEvent exactly once for 5 rapid events on the same file', () => {
    const onEvent = vi.fn();
    manager.activate('0', onEvent);

    const filePath = '/tmp/test-project/notes.md';

    // Fire 5 rapid change events
    for (let i = 0; i < 5; i++) {
      fakeWatcherEmitter.emit('change', filePath);
    }

    // No calls yet (debounce window hasn't expired)
    expect(onEvent).not.toHaveBeenCalled();

    // Advance past the 75ms debounce window
    vi.runAllTimers();

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      type: 'reload',
      path: 'notes.md',
      event: 'change',
    });
  });

  it('calls onEvent once per file for events on two different files', () => {
    const onEvent = vi.fn();
    manager.activate('0', onEvent);

    const file1 = '/tmp/test-project/notes.md';
    const file2 = '/tmp/test-project/readme.md';

    fakeWatcherEmitter.emit('change', file1);
    fakeWatcherEmitter.emit('change', file2);

    vi.runAllTimers();

    expect(onEvent).toHaveBeenCalledTimes(2);
  });

  it('coalesces multiple rapid events to the same file', () => {
    const onEvent = vi.fn();
    manager.activate('0', onEvent);

    const filePath = '/tmp/test-project/notes.md';

    // Rapid-fire: change, then add, then change again — should coalesce to last event
    fakeWatcherEmitter.emit('change', filePath);
    vi.advanceTimersByTime(30); // still within debounce window
    fakeWatcherEmitter.emit('add', filePath);
    vi.advanceTimersByTime(30); // still within debounce window
    fakeWatcherEmitter.emit('change', filePath);

    vi.runAllTimers();

    // Only the last event should fire
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reload', event: 'change' }),
    );
  });

  it('emits no events after deactivate() is called', () => {
    const onEvent = vi.fn();
    manager.activate('0', onEvent);

    fakeWatcherEmitter.emit('change', '/tmp/test-project/notes.md');
    manager.deactivate();

    vi.runAllTimers();

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('handles unknown project id gracefully without throwing', () => {
    const onEvent = vi.fn();
    expect(() => manager.activate('nonexistent', onEvent)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Lifecycle regression tests — real timers (no fake timer interference with
// microtask flushing, since these tests don't need debounce control)
// ---------------------------------------------------------------------------

describe('WatcherManager lifecycle', () => {
  let manager: WatcherManager;
  const watchMock = vi.mocked(chokidar.watch);

  beforeEach(() => {
    fakeWatcherEmitter.removeAllListeners();
    vi.clearAllMocks();
    // Fresh close mock each test
    fakeWatcherEmitter.close = vi.fn(() => Promise.resolve());
    manager = new WatcherManager({ current: MOCK_CONFIG });
  });

  afterEach(() => {
    manager.destroy();
    vi.clearAllMocks();
  });

  it('defers new watcher until previous watcher is fully closed (no fd leak)', async () => {
    const onEvent = vi.fn();

    // First activate starts synchronously (no prior watcher, closing=false).
    manager.activate('0', onEvent);
    expect(watchMock).toHaveBeenCalledTimes(1);

    // Re-activate while the first watcher is live. This should:
    //   1. Synchronously close the first watcher (setting closing=true)
    //   2. Defer the new watcher start until close() resolves
    manager.activate('0', onEvent);

    // close() was called on the first watcher
    expect(fakeWatcherEmitter.close).toHaveBeenCalledTimes(1);

    // But the new watcher has NOT been created yet (close is still in-flight)
    expect(watchMock).toHaveBeenCalledTimes(1);

    // setTimeout(fn, 0) advances to the next event-loop task, guaranteeing
    // all pending microtasks (the Promise chain close→catch→finally→then)
    // have drained before we assert.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    // The deferred activation ran: exactly one new watcher was started.
    expect(watchMock).toHaveBeenCalledTimes(2);
  });

  it('EMFILE error triggers teardown and watcher-warning, not a retry', () => {
    const onEvent = vi.fn();
    manager.activate('0', onEvent);

    // Watcher is now active; simulate EMFILE
    fakeWatcherEmitter.emit('error', Object.assign(new Error('EMFILE'), { code: 'EMFILE' }));

    // close() should have been called (deactivate tears down)
    expect(fakeWatcherEmitter.close).toHaveBeenCalledTimes(1);

    // onEvent should have received a watcher-warning
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'watcher-warning', projectId: '0' }),
    );

    // No second chokidar.watch() call — must NOT retry
    expect(watchMock).toHaveBeenCalledTimes(1);
  });

  it('hard cap exceeded sends watcher-warning and does not start a watcher', () => {
    const onEvent = vi.fn();
    // maxWatchedDirs: 0 means even the project root (1 dir) exceeds the cap
    const tinyCapConfig = {
      ...MOCK_CONFIG,
      watcher: { usePolling: false, maxWatchedDirs: 0 },
    };
    const cappedManager = new WatcherManager({ current: tinyCapConfig });

    try {
      cappedManager.activate('0', onEvent);

      // chokidar.watch should never have been called
      expect(watchMock).not.toHaveBeenCalled();

      // A watcher-warning must have been emitted
      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'watcher-warning', projectId: '0' }),
      );
    } finally {
      cappedManager.destroy();
    }
  });
});
