import { describe, expect, it } from "vitest";
import { vulnerabilities } from "../../src/checks/vulnerabilities";
import { makeRepoData } from "../helpers";

describe("vulnerabilities", () => {
	it("returns 10 when no OSV vulnerabilities found", () => {
		const result = vulnerabilities(makeRepoData());
		expect(result.score).toBe(10);
	});

	it("deducts per OSV vulnerability (OSSF scoring)", () => {
		const result = vulnerabilities(
			makeRepoData({
				osvVulnerabilities: [
					{ id: "GHSA-1", severity: "critical" },
					{ id: "GHSA-2", severity: "high" },
				],
			}),
		);
		expect(result.score).toBe(8);
	});

	it("minimum score is 0", () => {
		const result = vulnerabilities(
			makeRepoData({
				osvVulnerabilities: Array.from({ length: 15 }, (_, i) => ({
					id: `GHSA-${i}`,
					severity: "high",
				})),
			}),
		);
		expect(result.score).toBe(0);
	});

	it("falls back to Dependabot alerts when no OSV data but alerts enabled", () => {
		const result = vulnerabilities(
			makeRepoData({
				hasVulnerabilityAlertsEnabled: true,
				vulnerabilityAlerts: [{ severity: "critical", state: "open" }],
			}),
		);
		expect(result.score).toBe(9);
	});
});
