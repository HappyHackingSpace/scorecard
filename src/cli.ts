import { parseArgs } from "node:util";
import pkg from "../package.json";
import { computeScorecard } from "./scorecard";
import type { ScorecardResult } from "./types";

const USAGE = `Usage: scorecard <owner>/<repo> [options]

Compute OSSF Scorecard checks for a GitHub repository.

Options:
  -t, --token <token>   GitHub token (defaults to GITHUB_TOKEN or GH_TOKEN env)
  -c, --checks <list>   Comma-separated list of checks to run (default: all)
  -j, --json            Output raw JSON instead of a table
  -h, --help            Show this help
  -v, --version         Show version

Examples:
  scorecard happyhackingspace/scorecard
  scorecard ossf/scorecard --checks Maintained,License --json
`;

export interface CliOptions {
	owner: string;
	repo: string;
	token: string;
	checks?: string[];
	json: boolean;
}

export class CliError extends Error {}

/** Parses CLI arguments. Throws CliError with a user-facing message on bad input. */
export function parseCliArgs(argv: string[], env: Record<string, string | undefined>): CliOptions {
	const { values, positionals } = parseArgs({
		args: argv,
		allowPositionals: true,
		options: {
			token: { type: "string", short: "t" },
			checks: { type: "string", short: "c" },
			json: { type: "boolean", short: "j", default: false },
			help: { type: "boolean", short: "h", default: false },
			version: { type: "boolean", short: "v", default: false },
		},
	});

	if (values.help) throw new CliError(USAGE);
	if (values.version) throw new CliError(pkg.version);

	if (positionals.length !== 1) {
		throw new CliError(`Expected exactly one <owner>/<repo> argument.\n\n${USAGE}`);
	}
	const [owner, repo] = positionals[0].split("/");
	if (!owner || !repo || positionals[0].split("/").length !== 2) {
		throw new CliError(`Invalid repository "${positionals[0]}": expected <owner>/<repo>.`);
	}

	const token = values.token ?? env.GITHUB_TOKEN ?? env.GH_TOKEN;
	if (!token) {
		throw new CliError(
			"A GitHub token is required: pass --token or set GITHUB_TOKEN (or GH_TOKEN).",
		);
	}

	const checks = values.checks
		?.split(",")
		.map((c) => c.trim())
		.filter(Boolean);

	return { owner, repo, token, checks, json: values.json };
}

/** Renders a ScorecardResult as an aligned text table. */
export function formatTable(result: ScorecardResult): string {
	const rows = result.checks.map((c) => ({
		name: c.name,
		score: c.score < 0 ? "?" : c.score.toFixed(1),
		reason: c.reason,
	}));
	const nameWidth = Math.max(5, ...rows.map((r) => r.name.length));
	const scoreWidth = Math.max(5, ...rows.map((r) => r.score.length));

	const lines = [
		`${result.repo} — score: ${result.score}/10 (${result.date})`,
		"",
		`${"CHECK".padEnd(nameWidth)}  ${"SCORE".padStart(scoreWidth)}  REASON`,
	];
	for (const r of rows) {
		lines.push(`${r.name.padEnd(nameWidth)}  ${r.score.padStart(scoreWidth)}  ${r.reason}`);
	}
	return lines.join("\n");
}

export async function main(argv = process.argv.slice(2), env = process.env): Promise<number> {
	let options: CliOptions;
	try {
		options = parseCliArgs(argv, env);
	} catch (err) {
		if (err instanceof CliError) {
			console.log(err.message);
			return err.message === USAGE || err.message === pkg.version ? 0 : 2;
		}
		console.error(err instanceof Error ? err.message : String(err));
		return 2;
	}

	try {
		const result = await computeScorecard(options.owner, options.repo, {
			token: options.token,
			checks: options.checks,
		});
		console.log(options.json ? JSON.stringify(result, null, 2) : formatTable(result));
		return 0;
	} catch (err) {
		console.error(`scorecard: ${err instanceof Error ? err.message : String(err)}`);
		return 1;
	}
}
