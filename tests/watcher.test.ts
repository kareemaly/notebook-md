import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock chokidar before importing the module under test
// ---------------------------------------------------------------------------

const fakeWatcherEmitter = new EventEmitter() as EventEmitter & {
  close: () => Promise<void>;
};
fakeWatcherEmitter.close = () => Promise.resolve();

vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => fakeWatcherEmitter),
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks are in place
// ---------------------------------------------------------------------------

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
