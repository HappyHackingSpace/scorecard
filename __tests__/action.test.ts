import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionError, formatMarkdown, main, readInputs } from "../action/run";
import type { ScorecardResult } from "../src/types";

vi.mock("../src/index", () => ({
	computeScorecard: vi.fn(async (owner: string, repo: string) => ({
		date: "2026-11-01",
		repo: `${owner}/${repo}`,
		score: 7.6,
		checks: [{ name: "Maintained", score: 10, reason: "active" }],
	})),
}));

const baseEnv = {
	SCORECARD_REPO: "foo/bar",
	SCORECARD_TOKEN: "tkn",
	SCORECARD_CHECKS: "",
	SCORECARD_COMMENT_PR: "false",
	SCORECARD_FAIL_BELOW: "",
};

describe("readInputs", () => {
	it("parses repo, token and defaults", () => {
		expect(readInputs(baseEnv)).toEqual({
			owner: "foo",
			repo: "bar",
			token: "tkn",
			checks: undefined,
			commentPr: false,
			failBelow: undefined,
		});
	});

	it("requires repo and token", () => {
		expect(() => readInputs({ ...baseEnv, SCORECARD_REPO: "" })).toThrow(ActionError);
		expect(() => readInputs({ ...baseEnv, SCORECARD_TOKEN: "" })).toThrow(/token/i);
	});

	it("rejects a malformed repo", () => {
		expect(() => readInputs({ ...baseEnv, SCORECARD_REPO: "foobar" })).toThrow(/owner.*repo/i);
		expect(() => readInputs({ ...baseEnv, SCORECARD_REPO: "a/b/c" })).toThrow(/owner.*repo/i);
	});

	it("splits and trims checks", () => {
		const inputs = readInputs({ ...baseEnv, SCORECARD_CHECKS: "Maintained, License," });
		expect(inputs.checks).toEqual(["Maintained", "License"]);
	});

	it("parses comment-pr and fail-below", () => {
		const inputs = readInputs({
			...baseEnv,
			SCORECARD_COMMENT_PR: "true",
			SCORECARD_FAIL_BELOW: "7.5",
		});
		expect(inputs.commentPr).toBe(true);
		expect(inputs.failBelow).toBe(7.5);
	});

	it("rejects an out-of-range or non-numeric fail-below", () => {
		expect(() => readInputs({ ...baseEnv, SCORECARD_FAIL_BELOW: "eleven" })).toThrow(ActionError);
		expect(() => readInputs({ ...baseEnv, SCORECARD_FAIL_BELOW: "11" })).toThrow(
			/between 0 and 10/,
		);
		expect(() => readInputs({ ...baseEnv, SCORECARD_FAIL_BELOW: "-1" })).toThrow(
			/between 0 and 10/,
		);
	});
});

describe("formatMarkdown", () => {
	const result: ScorecardResult = {
		date: "2026-11-01",
		repo: "foo/bar",
		score: 7.6,
		checks: [
			{ name: "Maintained", score: 10, reason: "30 commits in last 90 days" },
			{ name: "License", score: -1, reason: "inconclusive | unknown\nlicense" },
		],
	};

	it("renders a heading, the aggregate score and one table row per check", () => {
		const out = formatMarkdown(result);
		expect(out).toContain("## OSSF Scorecard — foo/bar");
		expect(out).toContain("**Aggregate score: 7.6/10** (2026-11-01)");
		expect(out).toContain("| Maintained | 10.0 | 30 commits in last 90 days |");
	});

	it("renders inconclusive scores as a dash and escapes cell content", () => {
		const out = formatMarkdown(result);
		expect(out).toContain("| License | — | inconclusive \\| unknown license |");
	});
});

describe("main", () => {
	const dir = mkdtempSync(join(tmpdir(), "scorecard-action-"));

	afterEach(() => {
		delete process.env.GITHUB_OUTPUT;
		delete process.env.GITHUB_STEP_SUMMARY;
	});

	it("writes the summary and score/json outputs and returns 0", async () => {
		const outputFile = join(dir, "output");
		const summaryFile = join(dir, "summary");
		writeFileSync(outputFile, "");
		writeFileSync(summaryFile, "");
		process.env.GITHUB_OUTPUT = outputFile;
		process.env.GITHUB_STEP_SUMMARY = summaryFile;

		const code = await main(baseEnv);

		expect(code).toBe(0);
		const output = readFileSync(outputFile, "utf8");
		expect(output).toMatch(/score<<SCORECARD_EOF_\w+\n7\.6\n/);
		expect(output).toContain('"repo":"foo/bar"');
		expect(readFileSync(summaryFile, "utf8")).toContain("## OSSF Scorecard — foo/bar");
		rmSync(dir, { recursive: true, force: true });
	});

	it("fails when the score is below fail-below", async () => {
		const code = await main({ ...baseEnv, SCORECARD_FAIL_BELOW: "9" });
		expect(code).toBe(1);
	});

	it("passes when the score meets fail-below", async () => {
		const code = await main({ ...baseEnv, SCORECARD_FAIL_BELOW: "7" });
		expect(code).toBe(0);
	});
});
