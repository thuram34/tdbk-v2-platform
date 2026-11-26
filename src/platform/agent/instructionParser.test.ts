import { describe, expect, it } from "vitest";
import { instructionParser } from "./instructionParser";
import type { AgentInstruction } from "./types";

const context = {
  requestId: "req_browser_task",
  correlationId: "corr_browser_task",
  timestamp: new Date().toISOString(),
  principal: {
    id: "owner_browser_test",
    email: "owner@example.test",
    isMaster: false,
    tenantId: "tenant_tdbk_test",
    branchId: "branch_hq",
    roles: ["OWNER_OPERATOR"],
    permissions: ["workflow:execute"],
    authTime: 1,
    tokenSource: "JWT",
  },
  tenantContext: { tenantId: "tenant_tdbk_test" },
  branchContext: { tenantId: "tenant_tdbk_test", branchId: "branch_hq" },
} as unknown as AgentInstruction["context"];

describe("TDBK Browser Lab agent routing", () => {
  it("turns a structured browser task into an authorized workflow action", () => {
    const browserTask = {
      url: "https://tdbk.example.test",
      steps: [{ type: "inspect" as const }, { type: "assertText" as const, text: "TDBK" }],
    };
    const result = instructionParser.parse({
      instructionId: "req_browser_task",
      text: "Execute the submitted TDBK Browser Lab task.",
      context,
      requestedAuthority: "WORKFLOW",
      browserTask,
    });

    expect(result.intent).toBe("BROWSER_AUTOMATION");
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({
      kind: "RUN_BROWSER_AUTOMATION",
      authority: "WORKFLOW",
      tenantId: "tenant_tdbk_test",
      requiresAuthorization: true,
      browserTask,
    });
  });
});
