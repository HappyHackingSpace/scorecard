import { describe, expect, it } from "vitest";
import { license } from "../../src/checks/license";
import { makeRepoData } from "../helpers";

describe("license", () => {
	it("returns 0 when no license", () => {
		const result = license(
			makeRepoData({ licenseKey: null, licenseName: null, spdxId: null }),
		);
		expect(result.score).toBe(0);
	});

	it("returns 6 for detected license", () => {
		const result = license(makeRepoData({ licenseKey: "mit", licenseName: "MIT License" }));
		expect(result.score).toBe(6);
	});

	it("returns 10 for license with file and OSI approval", () => {
		const result = license(
			makeRepoData({
				licenseKey: "mit",
				licenseName: "MIT License",
				spdxId: "MIT",
				treeFiles: ["LICENSE", "src/main.ts"],
			}),
		);
		expect(result.score).toBe(10);
	});
});
