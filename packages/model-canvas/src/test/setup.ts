import { afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

afterEach(() => cleanup());

// jsdom has no ResizeObserver; @xyflow/react needs one to mount its panes.
// Anonymous canvas (post optional-sign-in) now renders the full canvas tree
// in more tests than before, so this stub is required for those to run.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
