import { describe, expect, it } from "vitest";
import { dependencyUpdateTool } from "../../src/checks/dependency-update-tool";
import { makeRepoData } from "../helpers";

describe("dependencyUpdateTool", () => {
	it("returns 10 when Dependabot is configured", () => {
		const result = dependencyUpdateTool(makeRepoData({ hasDependabot: true }));
		expect(result.score).toBe(10);
	});

	it("returns 10 when Renovate is configured", () => {
		const result = dependencyUpdateTool(makeRepoData({ hasRenovate: true }));
		expect(result.score).toBe(10);
	});

	it("returns 10 when both are configured", () => {
		const result = dependencyUpdateTool(makeRepoData({ hasDependabot: true, hasRenovate: true }));
		expect(result.score).toBe(10);
		expect(result.reason).toContain("Dependabot");
		expect(result.reason).toContain("Renovate");
	});

	it("returns 0 when none configured", () => {
		const result = dependencyUpdateTool(makeRepoData());
		expect(result.score).toBe(0);
	});
});
