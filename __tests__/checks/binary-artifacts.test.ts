import { describe, expect, it } from "vitest";
import { binaryArtifacts } from "../../src/checks/binary-artifacts";
import { makeRepoData } from "../helpers";

describe("binaryArtifacts", () => {
	it("returns 10 when no binaries found", () => {
		const result = binaryArtifacts(makeRepoData({ treeFiles: ["src/main.ts", "README.md"] }));
		expect(result.score).toBe(10);
	});

	it("deducts for binary files", () => {
		const result = binaryArtifacts(
			makeRepoData({ treeFiles: ["build/app.exe", "lib/helper.dll"] }),
		);
		expect(result.score).toBe(8);
	});

	it("returns 0 for many binaries", () => {
		const files = Array.from({ length: 15 }, (_, i) => `bin/file${i}.exe`);
		const result = binaryArtifacts(makeRepoData({ treeFiles: files }));
		expect(result.score).toBe(0);
	});
});
