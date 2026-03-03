import { describe, expect, it } from "vitest";
import { sbom } from "../../src/checks/sbom";
import { makeRepoData } from "../helpers";

describe("sbom", () => {
	it("returns 0 when no SBOM found", () => {
		const result = sbom(makeRepoData());
		expect(result.score).toBe(0);
	});

	it("returns 5 for SBOM file in repo", () => {
		const result = sbom(makeRepoData({ treeFiles: ["sbom.json"] }));
		expect(result.score).toBe(5);
	});

	it("returns 5 for SBOM in release", () => {
		const result = sbom(
			makeRepoData({
				releases: [
					{
						tagName: "v1.0",
						createdAt: new Date().toISOString(),
						assets: [{ name: "sbom.spdx.json", downloadUrl: "https://x" }],
					},
				],
			}),
		);
		expect(result.score).toBe(5);
	});

	it("returns 10 for both", () => {
		const result = sbom(
			makeRepoData({
				treeFiles: ["sbom.json"],
				releases: [
					{
						tagName: "v1.0",
						createdAt: new Date().toISOString(),
						assets: [{ name: "sbom.spdx.json", downloadUrl: "https://x" }],
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});
});
