import { describe, expect, it } from "vitest";
import { vulnerabilities } from "../../src/checks/vulnerabilities";
import { makeRepoData } from "../helpers";

describe("vulnerabilities", () => {
	it("returns -1 when alerts not enabled", () => {
		const result = vulnerabilities(
			makeRepoData({ hasVulnerabilityAlertsEnabled: false }),
		);
		expect(result.score).toBe(-1);
	});

	it("returns 10 when no open alerts", () => {
		const result = vulnerabilities(makeRepoData());
		expect(result.score).toBe(10);
	});

	it("deducts by severity", () => {
		const result = vulnerabilities(
			makeRepoData({
				vulnerabilityAlerts: [
					{ severity: "critical", state: "open" },
					{ severity: "high", state: "open" },
				],
			}),
		);
		expect(result.score).toBe(3);
	});

	it("ignores dismissed alerts", () => {
		const result = vulnerabilities(
			makeRepoData({
				vulnerabilityAlerts: [{ severity: "critical", state: "dismissed" }],
			}),
		);
		expect(result.score).toBe(10);
	});
});
