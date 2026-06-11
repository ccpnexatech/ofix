// jsdom lacks ResizeObserver; Radix Popover (tour engine) requires it.
class ResizeObserverStub {
  observe(): void {
    /* noop: jsdom has no layout */
  }

  unobserve(): void {
    /* noop */
  }

  disconnect(): void {
    /* noop */
  }
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub;
}
