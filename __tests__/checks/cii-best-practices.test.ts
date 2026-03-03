import { describe, expect, it } from "vitest";
import { ciiBestPractices } from "../../src/checks/cii-best-practices";
import { makeRepoData } from "../helpers";

describe("ciiBestPractices", () => {
	it("returns 0 when no badge", () => {
		const result = ciiBestPractices(makeRepoData());
		expect(result.score).toBe(0);
	});

	it("returns 5 for passing", () => {
		const result = ciiBestPractices(makeRepoData({ ciiBadgeLevel: "passing" }));
		expect(result.score).toBe(5);
	});

	it("returns 7 for silver", () => {
		const result = ciiBestPractices(makeRepoData({ ciiBadgeLevel: "silver" }));
		expect(result.score).toBe(7);
	});

	it("returns 10 for gold", () => {
		const result = ciiBestPractices(makeRepoData({ ciiBadgeLevel: "gold" }));
		expect(result.score).toBe(10);
	});
});
