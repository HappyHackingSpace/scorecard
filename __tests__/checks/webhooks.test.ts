import { describe, expect, it } from "vitest";
import { webhooks } from "../../src/checks/webhooks";
import { makeRepoData } from "../helpers";

describe("webhooks", () => {
	it("returns -1 when no webhooks", () => {
		const result = webhooks(makeRepoData());
		expect(result.score).toBe(-1);
	});

	it("returns 10 when all have secrets", () => {
		const result = webhooks(
			makeRepoData({
				webhooks: [{ id: 1, config: { secret: "s3cret" }, active: true }],
			}),
		);
		expect(result.score).toBe(10);
	});

	it("deducts for missing secrets", () => {
		const result = webhooks(
			makeRepoData({
				webhooks: [
					{ id: 1, config: { secret: "s3cret" }, active: true },
					{ id: 2, config: {}, active: true },
				],
			}),
		);
		expect(result.score).toBe(5);
	});

	it("ignores inactive webhooks", () => {
		const result = webhooks(
			makeRepoData({
				webhooks: [{ id: 1, config: {}, active: false }],
			}),
		);
		expect(result.score).toBe(-1);
	});
});
