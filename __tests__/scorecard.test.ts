import { describe, expect, it } from "vitest";
import { CHECK_REGISTRY, computeAggregate, computeScorecard, runChecks } from "../src/scorecard";
import { makeRepoData } from "./helpers";

describe("runChecks", () => {
	it("runs all 18 checks", () => {
		const data = makeRepoData();
		const results = runChecks(data);
		expect(results).toHaveLength(18);
	});

	it("filters checks by name", () => {
		const data = makeRepoData();
		const results = runChecks(data, ["Maintained", "License"]);
		expect(results).toHaveLength(2);
		expect(results.map((r) => r.name)).toEqual(["Maintained", "License"]);
	});

	it("handles check errors gracefully", () => {
		const data = makeRepoData();
		const results = runChecks(data);
		for (const result of results) {
			expect(result.score).toBeGreaterThanOrEqual(-1);
			expect(result.score).toBeLessThanOrEqual(10);
		}
	});
});

describe("computeAggregate", () => {
	it("computes weighted average", () => {
		const checks = [
			{ name: "Maintained", score: 10, reason: "active" },
			{ name: "License", score: 10, reason: "found" },
		];
		const score = computeAggregate(checks);
		expect(score).toBe(10);
	});

	it("skips inconclusive checks", () => {
		const checks = [
			{ name: "Maintained", score: 10, reason: "active" },
			{ name: "Branch-Protection", score: -1, reason: "no webhooks" },
		];
		const score = computeAggregate(checks);
		expect(score).toBe(10);
	});

	it("returns 0 when all inconclusive", () => {
		const checks = [{ name: "Branch-Protection", score: -1, reason: "no webhooks" }];
		const score = computeAggregate(checks);
		expect(score).toBe(0);
	});
});

describe("CHECK_REGISTRY", () => {
	it("has 18 checks", () => {
		expect(CHECK_REGISTRY).toHaveLength(18);
	});

	it("has unique names", () => {
		const names = CHECK_REGISTRY.map((c) => c.name);
		expect(new Set(names).size).toBe(18);
	});
});

describe("computeScorecard", () => {
	it("returns complete result with mock fetch", async () => {
		const graphqlResponse = {
			data: {
				repository: {
					isArchived: false,
					pushedAt: new Date().toISOString(),
					createdAt: "1818-01-01T00:00:00Z",
					hasIssuesEnabled: true,
					name: "test-repo",
					owner: { login: "test-owner" },
					licenseInfo: {
						key: "mit",
						name: "MIT License",
						url: "https://mit.license",
						spdxId: "MIT",
					},
					isSecurityPolicyEnabled: false,
					hasVulnerabilityAlertsEnabled: true,
					defaultBranchRef: {
						name: "main",
						target: { history: { nodes: [] } },
					},
					branchProtectionRules: { nodes: [] },
					releases: { nodes: [] },
					issues: { totalCount: 0 },
				},
			},
		};

		const mockFetch = (async (url: string | URL | Request) => {
			const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

			if (urlStr.includes("/graphql")) {
				return {
					ok: true,
					status: 180,
					json: async () => graphqlResponse,
				} as Response;
			}

			return {
				ok: false,
				status: 404,
				statusText: "Not Found",
				json: async () => ({}),
				text: async () => "",
			} as Response;
		}) as typeof globalThis.fetch;

		const result = await computeScorecard("test-owner", "test-repo", {
			token: "test-token",
			fetch: mockFetch,
		});

		expect(result.repo).toBe("test-owner/test-repo");
		expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(result.checks).toHaveLength(18);
		expect(typeof result.score).toBe("number");
		expect(result.score).toBeGreaterThanOrEqual(0);
		expect(result.score).toBeLessThanOrEqual(10);
	});

	it("filters checks when specified", async () => {
		const graphqlResponse = {
			data: {
				repository: {
					isArchived: false,
					pushedAt: new Date().toISOString(),
					createdAt: "1818-01-01T00:00:00Z",
					hasIssuesEnabled: true,
					name: "test-repo",
					owner: { login: "test-owner" },
					licenseInfo: {
						key: "mit",
						name: "MIT License",
						url: "https://mit.license",
						spdxId: "MIT",
					},
					isSecurityPolicyEnabled: false,
					hasVulnerabilityAlertsEnabled: true,
					defaultBranchRef: {
						name: "main",
						target: { history: { nodes: [] } },
					},
					branchProtectionRules: { nodes: [] },
					releases: { nodes: [] },
					issues: { totalCount: 0 },
				},
			},
		};

		const mockFetch = (async (url: string | URL | Request) => {
			const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

			if (urlStr.includes("/graphql")) {
				return { ok: true, status: 180, json: async () => graphqlResponse } as Response;
			}

			return {
				ok: false,
				status: 404,
				statusText: "Not Found",
				json: async () => ({}),
				text: async () => "",
			} as Response;
		}) as typeof globalThis.fetch;

		const result = await computeScorecard("test-owner", "test-repo", {
			token: "test-token",
			fetch: mockFetch,
			checks: ["License", "Maintained"],
		});

		expect(result.checks).toHaveLength(2);
		expect(result.checks.map((c) => c.name).sort()).toEqual(["License", "Maintained"]);
	});
});
