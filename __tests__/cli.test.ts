import { describe, expect, it } from "vitest";
import { CliError, formatTable, parseCliArgs } from "../src/cli";
import type { ScorecardResult } from "../src/types";

const env = { GITHUB_TOKEN: undefined, GH_TOKEN: undefined };

describe("parseCliArgs", () => {
	it("parses owner/repo and token flag", () => {
		const opts = parseCliArgs(["foo/bar", "--token", "tkn"], env);
		expect(opts).toMatchObject({ owner: "foo", repo: "bar", token: "tkn", json: false });
	});

	it("falls back to GITHUB_TOKEN then GH_TOKEN", () => {
		expect(parseCliArgs(["foo/bar"], { GITHUB_TOKEN: "a" }).token).toBe("a");
		expect(parseCliArgs(["foo/bar"], { GH_TOKEN: "b" }).token).toBe("b");
		expect(parseCliArgs(["foo/bar"], { GITHUB_TOKEN: "a", GH_TOKEN: "b" }).token).toBe("a");
	});

	it("requires a token", () => {
		expect(() => parseCliArgs(["foo/bar"], env)).toThrow(CliError);
		expect(() => parseCliArgs(["foo/bar"], env)).toThrow(/token/i);
	});

	it("rejects missing or malformed repo argument", () => {
		expect(() => parseCliArgs(["--token", "t"], env)).toThrow(/owner.*repo/i);
		expect(() => parseCliArgs(["foobar", "--token", "t"], env)).toThrow(/Invalid repository/);
		expect(() => parseCliArgs(["a/b/c", "--token", "t"], env)).toThrow(/Invalid repository/);
		expect(() => parseCliArgs(["a/b", "c/d", "--token", "t"], env)).toThrow(/exactly one/i);
	});

	it("splits and trims --checks", () => {
		const opts = parseCliArgs(["foo/bar", "-t", "t", "--checks", "Maintained, License,"], env);
		expect(opts.checks).toEqual(["Maintained", "License"]);
	});

	it("supports --json and short flags", () => {
		expect(parseCliArgs(["foo/bar", "-t", "t", "-j"], env).json).toBe(true);
	});

	it("throws usage on --help and version on --version", () => {
		expect(() => parseCliArgs(["--help"], env)).toThrow(/Usage:/);
		expect(() => parseCliArgs(["--version"], env)).toThrow(/^\d+\.\d+\.\d+/);
	});
});

describe("formatTable", () => {
	const result: ScorecardResult = {
		date: "2026-11-01",
		repo: "foo/bar",
		score: 7.6,
		checks: [
			{ name: "Maintained", score: 10, reason: "30 commits in last 90 days" },
			{ name: "License", score: -1, reason: "inconclusive" },
		],
	};

	it("renders header, score and one row per check", () => {
		const out = formatTable(result);
		expect(out).toContain("foo/bar — score: 7.6/10 (2026-11-01)");
		expect(out).toContain("CHECK");
		expect(out).toMatch(/Maintained\s+10\.0\s+30 commits/);
	});

	it("renders inconclusive scores as ?", () => {
		expect(formatTable(result)).toMatch(/License\s+\?\s+inconclusive/);
	});
});
