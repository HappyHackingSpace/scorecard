import { describe, expect, it } from "vitest";
import { signedReleases } from "../../src/checks/signed-releases";
import { makeRepoData } from "../helpers";

describe("signedReleases", () => {
	it("returns -1 when no releases", () => {
		const result = signedReleases(makeRepoData());
		expect(result.score).toBe(-1);
	});

	it("returns 10 for SLSA provenance", () => {
		const result = signedReleases(
			makeRepoData({
				releases: [
					{
						tagName: "v1.0",
						createdAt: new Date().toISOString(),
						assets: [{ name: "app.intoto.jsonl", downloadUrl: "https://x" }],
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 8 when all signed", () => {
		const result = signedReleases(
			makeRepoData({
				releases: [
					{
						tagName: "v1.0",
						createdAt: new Date().toISOString(),
						assets: [{ name: "release.sig", downloadUrl: "https://x" }],
					},
				],
			}),
		);
		expect(result.score).toBe(8);
	});

	it("scores proportionally for partial signing", () => {
		const result = signedReleases(
			makeRepoData({
				releases: [
					{
						tagName: "v1.0",
						createdAt: new Date().toISOString(),
						assets: [{ name: "release.sig", downloadUrl: "https://x" }],
					},
					{
						tagName: "v0.9",
						createdAt: new Date().toISOString(),
						assets: [{ name: "release.tar.gz", downloadUrl: "https://x" }],
					},
				],
			}),
		);
		expect(result.score).toBe(4);
	});
});
