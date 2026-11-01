import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { formatTable } from "../src/cli";
import { computeScorecard } from "../src/index";
import type { ScorecardResult } from "../src/types";

const COMMENT_MARKER = "<!-- happyhackingspace-scorecard -->";

export interface ActionInputs {
	owner: string;
	repo: string;
	token: string;
	checks?: string[];
	commentPr: boolean;
	failBelow?: number;
}

export class ActionError extends Error {}

export function readInputs(env: Record<string, string | undefined>): ActionInputs {
	const slug = env.SCORECARD_REPO?.trim();
	if (!slug) {
		throw new ActionError("Input `repo` is required (owner/repo).");
	}
	const parts = slug.split("/");
	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		throw new ActionError(`Invalid \`repo\` input "${slug}": expected <owner>/<repo>.`);
	}

	const token = env.SCORECARD_TOKEN?.trim();
	if (!token) {
		throw new ActionError("Input `token` is required.");
	}

	const checks = env.SCORECARD_CHECKS?.split(",")
		.map((c) => c.trim())
		.filter(Boolean);

	let failBelow: number | undefined;
	const failBelowRaw = env.SCORECARD_FAIL_BELOW?.trim();
	if (failBelowRaw) {
		failBelow = Number(failBelowRaw);
		if (Number.isNaN(failBelow) || failBelow < 0 || failBelow > 10) {
			throw new ActionError(
				`Invalid \`fail-below\` input "${failBelowRaw}": expected a number between 0 and 10.`,
			);
		}
	}

	return {
		owner: parts[0],
		repo: parts[1],
		token,
		checks: checks?.length ? checks : undefined,
		commentPr: env.SCORECARD_COMMENT_PR === "true",
		failBelow,
	};
}

function escapeCell(text: string): string {
	return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function formatMarkdown(result: ScorecardResult): string {
	const lines = [
		`## OSSF Scorecard — ${result.repo}`,
		"",
		`**Aggregate score: ${result.score}/10** (${result.date})`,
		"",
		"| Check | Score | Reason |",
		"|-------|------:|--------|",
	];
	for (const check of result.checks) {
		const score = check.score < 0 ? "—" : check.score.toFixed(1);
		lines.push(`| ${escapeCell(check.name)} | ${score} | ${escapeCell(check.reason)} |`);
	}
	return lines.join("\n");
}

function setOutput(name: string, value: string): void {
	const file = process.env.GITHUB_OUTPUT;
	if (!file) return;
	const delimiter = `SCORECARD_EOF_${randomBytes(16).toString("hex")}`;
	appendFileSync(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

function writeSummary(markdown: string): void {
	const file = process.env.GITHUB_STEP_SUMMARY;
	if (!file) return;
	appendFileSync(file, `${markdown}\n`);
}

interface IssueComment {
	id: number;
	body?: string;
}

async function upsertPrComment(token: string, markdown: string): Promise<void> {
	const eventName = process.env.GITHUB_EVENT_NAME;
	const eventPath = process.env.GITHUB_EVENT_PATH;
	if ((eventName !== "pull_request" && eventName !== "pull_request_target") || !eventPath) {
		console.log(
			`::warning::comment-pr is enabled but the event is "${eventName}", not a pull request; skipping comment.`,
		);
		return;
	}
	const event = JSON.parse(readFileSync(eventPath, "utf8")) as {
		pull_request?: { number?: number };
	};
	const prNumber = event.pull_request?.number;
	if (!prNumber) {
		throw new ActionError("Could not determine the pull request number from the event payload.");
	}

	const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
	const workflowRepo = process.env.GITHUB_REPOSITORY;
	if (!workflowRepo) {
		throw new ActionError("GITHUB_REPOSITORY is not set.");
	}
	const headers = {
		authorization: `Bearer ${token}`,
		accept: "application/vnd.github+json",
		"content-type": "application/json",
	};
	const body = `${COMMENT_MARKER}\n${markdown}`;

	const listUrl = `${apiUrl}/repos/${workflowRepo}/issues/${prNumber}/comments?per_page=100`;
	const listResponse = await fetch(listUrl, { headers });
	if (!listResponse.ok) {
		throw new ActionError(`Failed to list PR comments: HTTP ${listResponse.status}`);
	}
	const comments = (await listResponse.json()) as IssueComment[];
	const existing = comments.find((c) => c.body?.startsWith(COMMENT_MARKER));

	const target = existing
		? `${apiUrl}/repos/${workflowRepo}/issues/comments/${existing.id}`
		: `${apiUrl}/repos/${workflowRepo}/issues/${prNumber}/comments`;
	const response = await fetch(target, {
		method: existing ? "PATCH" : "POST",
		headers,
		body: JSON.stringify({ body }),
	});
	if (!response.ok) {
		throw new ActionError(
			`Failed to ${existing ? "update" : "create"} the PR comment: HTTP ${response.status}`,
		);
	}
	console.log(`${existing ? "Updated" : "Created"} scorecard comment on PR #${prNumber}.`);
}

export async function main(env = process.env): Promise<number> {
	let inputs: ActionInputs;
	try {
		inputs = readInputs(env);
	} catch (err) {
		console.log(`::error::${err instanceof Error ? err.message : String(err)}`);
		return 1;
	}

	let result: ScorecardResult;
	try {
		result = await computeScorecard(inputs.owner, inputs.repo, {
			token: inputs.token,
			checks: inputs.checks,
		});
	} catch (err) {
		console.log(`::error::scorecard failed: ${err instanceof Error ? err.message : String(err)}`);
		return 1;
	}

	console.log(formatTable(result));

	const markdown = formatMarkdown(result);
	writeSummary(markdown);
	setOutput("score", String(result.score));
	setOutput("json", JSON.stringify(result));

	if (inputs.commentPr) {
		try {
			await upsertPrComment(inputs.token, markdown);
		} catch (err) {
			console.log(`::error::${err instanceof Error ? err.message : String(err)}`);
			return 1;
		}
	}

	if (inputs.failBelow !== undefined && result.score < inputs.failBelow) {
		console.log(
			`::error::Score ${result.score} is below the fail-below threshold ${inputs.failBelow}.`,
		);
		return 1;
	}

	return 0;
}

if (import.meta.main) {
	main().then((code) => {
		process.exitCode = code;
	});
}
