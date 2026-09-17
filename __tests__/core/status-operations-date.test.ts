import { StatusOperations } from "../../src/core";

describe("StatusOperations.setDueDate", () => {
  it("leaves non-task lines unchanged", () => {
    const operations = new StatusOperations();
    expect(operations.setDueDate("A paragraph", "2026-09-21")).toBe("A paragraph");
  });
});
