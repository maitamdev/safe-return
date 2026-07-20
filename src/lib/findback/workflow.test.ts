import { describe, expect, it } from "vitest";
import {
  canMutateWorkflow,
  cleanWorkflowText,
  workflowStatusLabel,
} from "./workflow";

describe("claim workflow helpers", () => {
  it("cleans control characters and limits private messages", () => {
    expect(cleanWorkflowText("  xin\u0000 chào\r\nbạn  ", 20)).toBe("xin chào\nbạn");
    expect(cleanWorkflowText("abcdef", 3)).toBe("abc");
  });

  it("locks terminal and disputed workflows", () => {
    expect(canMutateWorkflow("awaiting_review")).toBe(true);
    expect(canMutateWorkflow("finder_delivered")).toBe(true);
    expect(canMutateWorkflow("settled")).toBe(false);
    expect(canMutateWorkflow("rejected")).toBe(false);
    expect(canMutateWorkflow("disputed")).toBe(false);
  });

  it("uses plain Vietnamese labels", () => {
    expect(workflowStatusLabel("handover_scheduled")).toBe("Đã thống nhất lịch giao đồ");
  });
});
