import { graphql, restGet, restGetRaw, type GitHubClientOptions } from "./github";
import { REPO_QUERY } from "./queries";
import type {
	CheckDefinition,
	RepoData,
	ScorecardCheck,
	ScorecardOptions,
	ScorecardResult,
} from "./types";
import { binaryArtifacts } from "./checks/binary-artifacts";
import { branchProtection } from "./checks/branch-protection";
import { ciTests } from "./checks/ci-tests";
import { ciiBestPractices } from "./checks/cii-best-practices";
import { codeReview } from "./checks/code-review";
import { contributors } from "./checks/contributors";
import { dangerousWorkflow } from "./checks/dangerous-workflow";
import { dependencyUpdateTool } from "./checks/dependency-update-tool";
import { fuzzing } from "./checks/fuzzing";
import { license } from "./checks/license";
import { maintained } from "./checks/maintained";
import { packaging } from "./checks/packaging";
import { pinnedDependencies } from "./checks/pinned-dependencies";
import { sast } from "./checks/sast";
import { sbom } from "./checks/sbom";
import { securityPolicy } from "./checks/security-policy";
import { signedReleases } from "./checks/signed-releases";
import { tokenPermissions } from "./checks/token-permissions";
import { vulnerabilities } from "./checks/vulnerabilities";
import { webhooks } from "./checks/webhooks";

const RISK_WEIGHTS = { Critical: 10, High: 7.5, Medium: 5, Low: 2.5 } as const;

const CHECK_REGISTRY: CheckDefinition[] = [
	{ name: "Maintained", risk: "High", fn: maintained },
	{ name: "Dependency-Update-Tool", risk: "High", fn: dependencyUpdateTool },
	{ name: "Binary-Artifacts", risk: "High", fn: binaryArtifacts },
	{ name: "Branch-Protection", risk: "High", fn: branchProtection },
	{ name: "CI-Tests", risk: "Low", fn: ciTests },
	{ name: "CII-Best-Practices", risk: "Low", fn: ciiBestPractices },
	{ name: "Code-Review", risk: "High", fn: codeReview },
	{ name: "Contributors", risk: "Low", fn: contributors },
	{ name: "Fuzzing", risk: "Medium", fn: fuzzing },
	{ name: "Packaging", risk: "Medium", fn: packaging },
	{ name: "Pinned-Dependencies", risk: "Medium", fn: pinnedDependencies },
	{ name: "SAST", risk: "Medium", fn: sast },
	{ name: "SBOM", risk: "Medium", fn: sbom },
	{ name: "Security-Policy", risk: "Medium", fn: securityPolicy },
	{ name: "Signed-Releases", risk: "High", fn: signedReleases },
	{ name: "Token-Permissions", risk: "High", fn: tokenPermissions },
	{ name: "Vulnerabilities", risk: "High", fn: vulnerabilities },
	{ name: "Dangerous-Workflow", risk: "Critical", fn: dangerousWorkflow },
	{ name: "License", risk: "Low", fn: license },
	{ name: "Webhooks", risk: "Critical", fn: webhooks },
];

interface GraphQLResponse {
	repository: {
		isArchived: boolean;
		pushedAt: string;
		createdAt: string;
		hasIssuesEnabled: boolean;
		name: string;
		owner: { login: string };
		licenseInfo: { key: string; name: string; url: string; spdxId: string } | null;
		isSecurityPolicyEnabled: boolean;
		hasVulnerabilityAlertsEnabled: boolean;
		defaultBranchRef: {
			name: string;
			target: {
				history: {
					nodes: {
						message: string;
						committedDate: string;
						author: {
							user: { login: string; organization: { login: string } | null } | null;
						};
						associatedPullRequests: {
							nodes: { merged: boolean; reviews: { totalCount: number } }[];
						};
						statusCheckRollup: { state: string } | null;
					}[];
				};
			};
		} | null;
		branchProtectionRules: {
			nodes: {
				allowsForcePushes: boolean;
				allowsDeletions: boolean;
				requiresApprovingReviews: boolean;
				requiredApprovingReviewCount: number;
				requiresStatusChecks: boolean;
				requiresCodeOwnerReviews: boolean;
				dismissesStaleReviews: boolean;
				isAdminEnforced: boolean;
			}[];
		};
		releases: {
			nodes: {
				tagName: string;
				createdAt: string;
				releaseAssets: { nodes: { name: string; downloadUrl: string }[] };
			}[];
		};
		issues: { totalCount: number };
	};
}

const fetchWorkflowFiles = async (
	client: GitHubClientOptions,
	owner: string,
	repo: string,
): Promise<{ path: string; content: string }[]> => {
	const listing = await restGet<{ tree: { path: string; type: string }[] }>(
		client,
		`/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
	);
	if (!listing) return [];

	const workflowPaths = listing.tree
		.filter((f) => f.type === "blob" && f.path.startsWith(".github/workflows/") && f.path.endsWith(".yml"))
		.map((f) => f.path);

	const files = await Promise.allSettled(
		workflowPaths.map(async (path) => {
			const content = await restGetRaw(
				client,
				`/repos/${owner}/${repo}/contents/${path}`,
			);
			return content ? { path, content } : null;
		}),
	);

	return files
		.filter((r): r is PromiseFulfilledResult<{ path: string; content: string } | null> => r.status === "fulfilled")
		.map((r) => r.value)
		.filter((v): v is { path: string; content: string } => v !== null);
};

const assembleRepoData = async (
	client: GitHubClientOptions,
	owner: string,
	repo: string,
): Promise<RepoData> => {
	const gql = await graphql<GraphQLResponse>(client, REPO_QUERY, { owner, repo });
	const r = gql.repository;

	const defaultRef = r.defaultBranchRef;
	const commitNodes = defaultRef?.target?.history?.nodes ?? [];

	const [workflowFiles, dependabotContent, renovateContent, treeData, vulnAlerts, ciiData, webhookData, securityPolicyContent] =
		await Promise.allSettled([
			fetchWorkflowFiles(client, owner, repo),
			restGetRaw(client, `/repos/${owner}/${repo}/contents/.github/dependabot.yml`),
			restGetRaw(client, `/repos/${owner}/${repo}/contents/renovate.json`),
			restGet<{ tree: { path: string; type: string }[] }>(
				client,
				`/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
			),
			restGet<{ severity: string; state: string }[]>(
				client,
				`/repos/${owner}/${repo}/dependabot/alerts?state=open&per_page=100`,
			),
			restGet<{ badge_level?: string }[]>(
				client,
				`https://www.bestpractices.dev/projects.json?url=https://github.com/${owner}/${repo}`,
			),
			restGet<{ id: number; config: { secret?: string }; active: boolean }[]>(
				client,
				`/repos/${owner}/${repo}/hooks`,
			),
			r.isSecurityPolicyEnabled
				? restGetRaw(client, `/repos/${owner}/${repo}/contents/SECURITY.md`)
				: Promise.resolve(null),
		]);

	const settled = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
		result.status === "fulfilled" ? result.value : fallback;

	const ciiResult = settled(ciiData, null);
	const ciiBadgeLevel = Array.isArray(ciiResult) && ciiResult.length > 0
		? (ciiResult[0].badge_level ?? null)
		: null;

	const treeResult = settled(treeData, null);

	return {
		owner,
		repo,
		isArchived: r.isArchived,
		pushedAt: r.pushedAt,
		createdAt: r.createdAt,
		hasIssues: r.hasIssuesEnabled,
		defaultBranch: defaultRef?.name ?? "main",
		licenseKey: r.licenseInfo?.key ?? null,
		licenseName: r.licenseInfo?.name ?? null,
		licenseUrl: r.licenseInfo?.url ?? null,
		spdxId: r.licenseInfo?.spdxId ?? null,
		isSecurityPolicyEnabled: r.isSecurityPolicyEnabled,
		securityPolicyContent: settled(securityPolicyContent, null),
		hasVulnerabilityAlertsEnabled: r.hasVulnerabilityAlertsEnabled,
		branchProtectionRules: r.branchProtectionRules.nodes,
		recentCommits: commitNodes.map((c) => ({
			message: c.message,
			committedDate: c.committedDate,
			author: {
				login: c.author.user?.login ?? "unknown",
				organization: c.author.user?.organization?.login ?? null,
			},
			associatedPullRequest:
				c.associatedPullRequests.nodes.length > 0
					? {
							merged: c.associatedPullRequests.nodes[0].merged,
							reviews: c.associatedPullRequests.nodes[0].reviews.totalCount,
						}
					: null,
			statusCheckRollup: c.statusCheckRollup?.state ?? null,
		})),
		releases: r.releases.nodes.map((rel) => ({
			tagName: rel.tagName,
			createdAt: rel.createdAt,
			assets: rel.releaseAssets.nodes.map((a) => ({
				name: a.name,
				downloadUrl: a.downloadUrl,
			})),
		})),
		workflowFiles: settled(workflowFiles, []),
		hasDependabot: settled(dependabotContent, null) !== null,
		hasRenovate: settled(renovateContent, null) !== null,
		treeFiles: treeResult?.tree?.map((f) => f.path) ?? [],
		vulnerabilityAlerts: (settled(vulnAlerts, null) ?? []).map((a) => ({
			severity: a.severity,
			state: a.state,
		})),
		ciiBadgeLevel,
		webhooks: settled(webhookData, null) ?? [],
		issueActivityCount: r.issues.totalCount,
	};
};

const runChecks = (data: RepoData, selectedChecks?: string[]): ScorecardCheck[] => {
	const checksToRun = selectedChecks
		? CHECK_REGISTRY.filter((c) => selectedChecks.includes(c.name))
		: CHECK_REGISTRY;

	return checksToRun.map((check) => {
		try {
			const result = check.fn(data);
			return { name: check.name, ...result };
		} catch {
			return { score: -1, name: check.name, reason: "Check failed with error" };
		}
	});
};

const computeAggregate = (checks: ScorecardCheck[]): number => {
	let weightedSum = 0;
	let totalWeight = 0;

	for (const check of checks) {
		if (check.score < 0) continue;

		const def = CHECK_REGISTRY.find((c) => c.name === check.name);
		if (!def) continue;

		const weight = RISK_WEIGHTS[def.risk];
		weightedSum += weight * check.score;
		totalWeight += weight;
	}

	if (totalWeight === 0) return 0;

	return Math.round((weightedSum / totalWeight) * 10) / 10;
};

export const computeScorecard = async (
	owner: string,
	repo: string,
	options: ScorecardOptions,
): Promise<ScorecardResult> => {
	const fetchFn = options.fetch ?? globalThis.fetch;
	const client: GitHubClientOptions = { token: options.token, fetch: fetchFn };

	const data = await assembleRepoData(client, owner, repo);
	const checks = runChecks(data, options.checks);
	const score = computeAggregate(checks);

	return {
		date: new Date().toISOString().split("T")[0],
		repo: `${owner}/${repo}`,
		score,
		checks,
	};
};

export { CHECK_REGISTRY, runChecks, computeAggregate };
