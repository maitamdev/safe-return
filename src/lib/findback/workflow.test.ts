import { describe, expect, it } from "vitest";
import {
  canMutateWorkflow,
  cleanWorkflowText,
  workflowStatusLabel,
} from "./workflow";

describe("claim workflow helpers", () => {
  it("strips control characters and caps length", () => {
    expect(cleanWorkflowText("  hello\u0000world\r\nnext  ", 20)).toBe("helloworld\nnext");
    expect(cleanWorkflowText("x".repeat(50), 10)).toHaveLength(10);
  });

  it("locks mutations after terminal statuses", () => {
    expect(canMutateWorkflow("awaiting_review")).toBe(true);
    expect(canMutateWorkflow("handover_scheduled")).toBe(true);
    expect(canMutateWorkflow("settled")).toBe(false);
    expect(canMutateWorkflow("rejected")).toBe(false);
    expect(canMutateWorkflow("disputed")).toBe(false);
    expect(canMutateWorkflow("rejection_pending")).toBe(false);
  });

  it("returns Vietnamese labels for every status", () => {
    expect(workflowStatusLabel("awaiting_review")).toContain("chủ đồ");
    expect(workflowStatusLabel("settled")).toContain("trả thưởng");
    expect(workflowStatusLabel("disputed")).toBeTruthy();
  });
});
