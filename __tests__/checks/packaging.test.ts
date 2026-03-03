import { describe, expect, it } from "vitest";
import { packaging } from "../../src/checks/packaging";
import { makeRepoData } from "../helpers";

describe("packaging", () => {
	it("returns 0 when no publishing detected", () => {
		const result = packaging(makeRepoData());
		expect(result.score).toBe(0);
	});

	it("returns 10 when npm publish found", () => {
		const result = packaging(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/publish.yml",
						content: "run: npm publish",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("returns 10 when docker push found", () => {
		const result = packaging(
			makeRepoData({
				workflowFiles: [
					{
						path: ".github/workflows/docker.yml",
						content: "uses: docker/build-push-action@v5",
					},
				],
			}),
		);
		expect(result.score).toBe(10);
	});
});
