import { afterEach } from "vitest";

import { cleanup } from "@testing-library/react";

// Unmount React trees between tests (Testing Library doesn't auto-clean here).
afterEach(() => {
  cleanup();
});
