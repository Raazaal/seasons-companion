import { expect } from "vitest";

expect.extend({
  toBeInTheDocument(element) {
    const pass = element && element.parentElement;
    return {
      pass,
      message: () => (pass ? "Element is in the document" : "Element is not in the document"),
    };
  },
});
