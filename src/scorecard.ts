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
import { securityPolicy } from "./checks/security-policy";
import { signedReleases } from "./checks/signed-releases";
import { tokenPermissions } from "./checks/token-permissions";
import { vulnerabilities } from "./checks/vulnerabilities";
import { type GitHubClientOptions, graphql, restGet, restGetRaw } from "./github";
import { REPO_QUERY } from "./queries";
import type {
	CheckDefinition,
	RepoData,
	ScorecardCheck,
	ScorecardOptions,
	ScorecardResult,
} from "./types";

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
	{ name: "Security-Policy", risk: "Medium", fn: securityPolicy },
	{ name: "Signed-Releases", risk: "High", fn: signedReleases },
	{ name: "Token-Permissions", risk: "High", fn: tokenPermissions },
	{ name: "Vulnerabilities", risk: "High", fn: vulnerabilities },
	{ name: "Dangerous-Workflow", risk: "Critical", fn: dangerousWorkflow },
	{ name: "License", risk: "Low", fn: license },
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
							nodes: {
								merged: boolean;
								headRefOid: string;
								reviews: { totalCount: number };
								labels: { nodes: { name: string }[] };
							}[];
						};
						statusCheckRollup: { state: string } | null;
					}[];
				};
			};
		} | null;
		releases: {
			nodes: {
				tagName: string;
				createdAt: string;
				releaseAssets: { nodes: { name: string; downloadUrl: string }[] };
			}[];
		} | null;
		issues: { totalCount: number } | null;
	} | null;
}

const fetchWorkflowFiles = async (
	client: GitHubClientOptions,
	owner: string,
	repo: string,
): Promise<{ path: string; content: string }[]> => {
	// Use Contents API to list .github/workflows/ directly — more reliable for large repos
	// than recursive tree listing which truncates at ~100k entries
	const dirListing = await restGet<{ name: string; path: string; type: string }[]>(
		client,
		`/repos/${owner}/${repo}/contents/.github/workflows`,
	);

	if (!dirListing || !Array.isArray(dirListing)) return [];

	const workflowPaths = dirListing
		.filter(
			(f) =>
				f.type === "file" &&
				(f.name.endsWith(".yml") || f.name.endsWith(".yaml")),
		)
		.map((f) => f.path);

	const files = await Promise.allSettled(
		workflowPaths.map(async (path) => {
			const content = await restGetRaw(client, `/repos/${owner}/${repo}/contents/${path}`);
			return content ? { path, content } : null;
		}),
	);

	return files
		.filter(
			(r): r is PromiseFulfilledResult<{ path: string; content: string } | null> =>
				r.status === "fulfilled",
		)
		.map((r) => r.value)
		.filter((v): v is { path: string; content: string } => v !== null);
};

interface OsvPackage {
	ecosystem: string;
	name: string;
	version: string;
}

const parseDependencyFile = (path: string, content: string): OsvPackage[] => {
	const filename = path.split("/").pop() ?? "";
	const packages: OsvPackage[] = [];

	if (filename === "package-lock.json") {
		try {
			const lock = JSON.parse(content);
			// npm lockfile v2/v3
			const deps = lock.packages ?? lock.dependencies ?? {};
			for (const [name, info] of Object.entries(deps)) {
				const pkg = info as { version?: string };
				if (name && pkg.version && name !== "") {
					const cleanName = name.replace(/^node_modules\//, "");
					if (cleanName) {
						packages.push({ ecosystem: "npm", name: cleanName, version: pkg.version });
					}
				}
			}
		} catch {
			// Invalid JSON
		}
	} else if (filename === "go.sum") {
		for (const line of content.split("\n")) {
			const match = line.match(/^(\S+)\s+(v\S+?)(?:\/go\.mod)?\s+/);
			if (match) {
				packages.push({ ecosystem: "Go", name: match[1], version: match[2] });
			}
		}
	} else if (filename === "requirements.txt") {
		for (const line of content.split("\n")) {
			const match = line.match(/^([a-zA-Z0-9_.-]+)==([^\s;#]+)/);
			if (match) {
				packages.push({ ecosystem: "PyPI", name: match[1], version: match[2] });
			}
		}
	} else if (filename === "Cargo.lock") {
		const blocks = content.split("[[package]]");
		for (const block of blocks) {
			const name = block.match(/name\s*=\s*"([^"]+)"/)?.[1];
			const version = block.match(/version\s*=\s*"([^"]+)"/)?.[1];
			if (name && version) {
				packages.push({ ecosystem: "crates.io", name, version });
			}
		}
	} else if (filename === "Gemfile.lock") {
		const specsSection = content.match(/GEM[\s\S]*?specs:\n([\s\S]*?)(?:\n\S|\n\n|$)/);
		if (specsSection) {
			for (const line of specsSection[1].split("\n")) {
				const match = line.match(/^\s{4}(\S+)\s+\(([^)]+)\)/);
				if (match) {
					packages.push({ ecosystem: "RubyGems", name: match[1], version: match[2] });
				}
			}
		}
	} else if (filename === "composer.lock") {
		try {
			const lock = JSON.parse(content);
			for (const pkg of [...(lock.packages ?? []), ...(lock["packages-dev"] ?? [])]) {
				if (pkg.name && pkg.version) {
					packages.push({
						ecosystem: "Packagist",
						name: pkg.name,
						version: pkg.version.replace(/^v/, ""),
					});
				}
			}
		} catch {
			// Invalid JSON
		}
	}

	// Limit to avoid oversized OSV requests
	return packages.slice(0, 500);
};

const queryOsv = async (
	fetchFn: typeof globalThis.fetch,
	packages: OsvPackage[],
): Promise<{ id: string; severity: string }[]> => {
	const queries = packages.map((p) => ({
		package: { ecosystem: p.ecosystem, name: p.name },
		version: p.version,
	}));

	// OSV batch query, chunk to 1000 max
	const chunks = [];
	for (let i = 0; i < queries.length; i += 1000) {
		chunks.push(queries.slice(i, i + 1000));
	}

	const vulns: { id: string; severity: string }[] = [];

	for (const chunk of chunks) {
		try {
			const res = await fetchFn("https://api.osv.dev/v1/querybatch", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ queries: chunk }),
			});
			if (!res.ok) continue;
			const data = (await res.json()) as { results: { vulns?: { id: string; severity?: { type: string; score: string }[] }[] }[] };
			for (const result of data.results) {
				for (const vuln of result.vulns ?? []) {
					const severity = vuln.severity?.[0]?.score
						? Number(vuln.severity[0].score) >= 9
							? "critical"
							: Number(vuln.severity[0].score) >= 7
								? "high"
								: Number(vuln.severity[0].score) >= 4
									? "medium"
									: "low"
						: "unknown";
					vulns.push({ id: vuln.id, severity });
				}
			}
		} catch {
			// OSV API error, skip
		}
	}

	// Deduplicate by ID
	const seen = new Set<string>();
	return vulns.filter((v) => {
		if (seen.has(v.id)) return false;
		seen.add(v.id);
		return true;
	});
};

const assembleRepoData = async (
	client: GitHubClientOptions,
	owner: string,
	repo: string,
	fetchFn: typeof globalThis.fetch,
): Promise<RepoData> => {
	const gql = await graphql<GraphQLResponse>(client, REPO_QUERY, { owner, repo });
	const r = gql.repository;

	if (!r) {
		throw new Error(`Repository ${owner}/${repo} not found or not accessible`);
	}

	const defaultRef = r.defaultBranchRef;
	const commitNodes = defaultRef?.target?.history?.nodes ?? [];

	const branchName = defaultRef?.name ?? "main";

	const [
		workflowFiles,
		dependabotContent,
		renovateContent,
		treeData,
		vulnAlerts,
		ciiData,
		webhookData,
		securityPolicyContent,
		branchProtection,
		ossFuzzData,
		workflowRunsData,
	] = await Promise.allSettled([
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
			? restGetRaw(client, `/repos/${owner}/${repo}/contents/SECURITY.md`).then(
					async (content) => {
						if (content) return content;
						// Fallback: check org-level .github repo
						return restGetRaw(client, `/repos/${owner}/.github/contents/SECURITY.md`);
					},
				)
			: Promise.resolve(null),
		restGet<{
			allow_force_pushes: { enabled: boolean };
			allow_deletions: { enabled: boolean };
			required_pull_request_reviews: {
				required_approving_review_count: number;
				require_code_owner_reviews: boolean;
				dismiss_stale_reviews: boolean;
			} | null;
			required_status_checks: { strict: boolean } | null;
			enforce_admins: { enabled: boolean };
		}>(client, `/repos/${owner}/${repo}/branches/${branchName}/protection`),
		fetchFn("https://oss-fuzz-build-logs.storage.googleapis.com/status.json")
			.then((res) => (res.ok ? res.json() : null))
			.then((data: { projects?: { main_repo?: string }[] } | null) => {
				if (!data?.projects) return false;
				const repoUrl = `github.com/${owner}/${repo}`.toLowerCase();
				return data.projects.some((p) => {
					const normalized = (p.main_repo ?? "")
						.toLowerCase()
						.replace(/^https?:\/\//, "")
						.replace(/\.git$/, "");
					return normalized === repoUrl;
				});
			})
			.catch(() => false),
		restGet<{ workflow_runs: { path: string; conclusion: string }[] }>(
			client,
			`/repos/${owner}/${repo}/actions/runs?status=success&per_page=100`,
		),
	]);

	const settled = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
		result.status === "fulfilled" ? result.value : fallback;

	const ciiResult = settled(ciiData, null);
	const ciiBadgeLevel =
		Array.isArray(ciiResult) && ciiResult.length > 0 ? (ciiResult[0].badge_level ?? null) : null;

	const treeResult = settled(treeData, null);
	const allTreeFiles = treeResult?.tree?.map((f) => f.path) ?? [];

	// Fetch Dockerfiles for Pinned-Dependencies check (up to 5)
	const dockerfilePaths = allTreeFiles
		.filter((f) => /dockerfile/i.test(f.split("/").pop() ?? ""))
		.slice(0, 5);

	const dockerfileResults = await Promise.allSettled(
		dockerfilePaths.map(async (path) => {
			const content = await restGetRaw(client, `/repos/${owner}/${repo}/contents/${path}`);
			return content ? { path, content } : null;
		}),
	);

	const dockerfiles = dockerfileResults
		.filter(
			(r): r is PromiseFulfilledResult<{ path: string; content: string } | null> =>
				r.status === "fulfilled",
		)
		.map((r) => r.value)
		.filter((v): v is { path: string; content: string } => v !== null);

	// Fetch contributor data: list top contributors, then get their orgs + company
	// OSSF uses REST Organizations.List + Users.Get per contributor
	const contributorsRaw = await restGet<{ login: string; contributions: number }[]>(
		client,
		`/repos/${owner}/${repo}/contributors?per_page=30`,
	);
	const topContributors = (contributorsRaw ?? []).filter((c) => c.contributions >= 5);
	const contributorDetails = await Promise.allSettled(
		topContributors.slice(0, 20).map(async (c) => {
			const [orgsResult, userResult] = await Promise.allSettled([
				restGet<{ login: string }[]>(client, `/users/${c.login}/orgs`),
				restGet<{ company: string | null }>(client, `/users/${c.login}`),
			]);
			const orgs = (orgsResult.status === "fulfilled" ? orgsResult.value : null) ?? [];
			const user = userResult.status === "fulfilled" ? userResult.value : null;
			const company = user?.company?.replace(/^@/, "").trim() || null;
			return {
				login: c.login,
				contributions: c.contributions,
				organizations: orgs.map((o) => o.login),
				company,
			};
		}),
	);
	const contributorData = contributorDetails
		.filter(
			(r): r is PromiseFulfilledResult<{
				login: string;
				contributions: number;
				organizations: string[];
				company: string | null;
			}> => r.status === "fulfilled",
		)
		.map((r) => r.value);

	// Fetch check runs for merged PRs (OSSF uses ListCheckRunsForRef per PR head SHA)
	const CI_PATTERNS = [
		"appveyor", "buildkite", "circleci", "e2e", "github-actions",
		"jenkins", "test", "travis-ci", "cirrus-ci", "azure-pipelines",
		"ci/woodpecker", "codebuild",
	];
	// OSSF SAST app slugs from checks/raw/sast.go
	const SAST_APP_SLUGS = [
		"github-advanced-security", "github-code-scanning",
		"lgtm-com", "sonarcloud", "sonarqubecloud",
	];
	const SAST_ALLOWED_CONCLUSIONS = ["success", "neutral"];
	const mergedPRSHAs = commitNodes
		.filter((c) => c.associatedPullRequests.nodes.length > 0 && c.associatedPullRequests.nodes[0].merged)
		.map((c) => c.associatedPullRequests.nodes[0].headRefOid)
		.filter((sha): sha is string => !!sha);

	const uniqueSHAs = [...new Set(mergedPRSHAs)].slice(0, 30);
	const checkRunResults = await Promise.allSettled(
		uniqueSHAs.map(async (sha) => {
			const [checkRuns, statuses] = await Promise.allSettled([
				restGet<{ check_runs: { name: string; status: string; conclusion: string | null; app: { slug: string } | null }[] }>(
					client,
					`/repos/${owner}/${repo}/commits/${sha}/check-runs?per_page=100`,
				),
				restGet<{ state: string; context: string }[]>(
					client,
					`/repos/${owner}/${repo}/commits/${sha}/statuses?per_page=100`,
				),
			]);
			const runs = checkRuns.status === "fulfilled" ? checkRuns.value?.check_runs ?? [] : [];
			const stats = statuses.status === "fulfilled" ? statuses.value ?? [] : [];

			const hasCI = runs.some((r) =>
				r.status === "completed" &&
				(r.conclusion === "success" || r.conclusion === "neutral") &&
				CI_PATTERNS.some((p) => r.name.toLowerCase().includes(p) || (r.app?.slug ?? "").toLowerCase().includes(p)),
			) || stats.some((s) =>
				s.state === "success" &&
				CI_PATTERNS.some((p) => s.context.toLowerCase().includes(p)),
			);

			// OSSF SAST detection: check suites by app slug with completed status + success/neutral conclusion
			const hasSAST = runs.some((r) =>
				r.status === "completed" &&
				SAST_ALLOWED_CONCLUSIONS.includes(r.conclusion ?? "") &&
				SAST_APP_SLUGS.includes((r.app?.slug ?? "").toLowerCase()),
			);

			return { sha, hasCIChecks: hasCI, hasSASTCheck: hasSAST };
		}),
	);
	// Build lookup map from unique SHA results (API calls are deduplicated for efficiency)
	const checkResultMap = new Map<string, { hasCIChecks: boolean; hasSASTCheck: boolean }>();
	for (const r of checkRunResults) {
		if (r.status === "fulfilled") {
			checkResultMap.set(r.value.sha, { hasCIChecks: r.value.hasCIChecks, hasSASTCheck: r.value.hasSASTCheck });
		}
	}
	// OSSF counts per-commit (not per-unique-SHA) — expand back to all merged PR SHAs
	const mergedPRCIResults = mergedPRSHAs.map((sha) => {
		const result = checkResultMap.get(sha);
		return { sha, hasCIChecks: result?.hasCIChecks ?? false };
	});
	const mergedPRSASTResults = mergedPRSHAs.map((sha) => {
		const result = checkResultMap.get(sha);
		return { sha, hasSASTCheck: result?.hasSASTCheck ?? false };
	});

	// Fetch dependency files and query OSV for vulnerabilities
	// OSSF uses osv-scanner, we query the OSV API
	const depFiles = [
		"package-lock.json",
		"go.sum",
		"requirements.txt",
		"Cargo.lock",
		"Gemfile.lock",
		"composer.lock",
		"pom.xml",
	];
	const depFilePath = allTreeFiles.find((f) => depFiles.includes(f.split("/").pop() ?? ""));
	let osvVulnerabilities: { id: string; severity: string }[] = [];

	if (depFilePath) {
		const depContent = await restGetRaw(client, `/repos/${owner}/${repo}/contents/${depFilePath}`);
		if (depContent) {
			const packages = parseDependencyFile(depFilePath, depContent);
			if (packages.length > 0) {
				const osvResult = await queryOsv(fetchFn, packages);
				osvVulnerabilities = osvResult;
			}
		}
	}

	return {
		owner,
		repo,
		isArchived: r.isArchived,
		pushedAt: r.pushedAt,
		createdAt: r.createdAt,
		hasIssues: r.hasIssuesEnabled,
		defaultBranch: branchName,
		licenseKey: r.licenseInfo?.key ?? null,
		licenseName: r.licenseInfo?.name ?? null,
		licenseUrl: r.licenseInfo?.url ?? null,
		spdxId: r.licenseInfo?.spdxId ?? null,
		isSecurityPolicyEnabled: r.isSecurityPolicyEnabled,
		securityPolicyContent: settled(securityPolicyContent, null),
		hasVulnerabilityAlertsEnabled: settled(vulnAlerts, null) !== null,
		branchProtectionRules: (() => {
			const bp = settled(branchProtection, null);
			if (!bp) return [];
			return [
				{
					allowsForcePushes: bp.allow_force_pushes?.enabled ?? false,
					allowsDeletions: bp.allow_deletions?.enabled ?? false,
					requiresApprovingReviews: bp.required_pull_request_reviews !== null,
					requiredApprovingReviewCount:
						bp.required_pull_request_reviews?.required_approving_review_count ?? 0,
					requiresStatusChecks: bp.required_status_checks !== null,
					requiresCodeOwnerReviews:
						bp.required_pull_request_reviews?.require_code_owner_reviews ?? false,
					dismissesStaleReviews:
						bp.required_pull_request_reviews?.dismiss_stale_reviews ?? false,
					isAdminEnforced: bp.enforce_admins?.enabled ?? false,
				},
			];
		})(),
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
							headSHA: c.associatedPullRequests.nodes[0].headRefOid,
							reviews: c.associatedPullRequests.nodes[0].reviews.totalCount,
							labels: (c.associatedPullRequests.nodes[0].labels?.nodes ?? []).map(
								(l) => l.name,
							),
						}
					: null,
			statusCheckRollup: c.statusCheckRollup?.state ?? null,
		})),
		releases: (r.releases?.nodes ?? []).map((rel) => ({
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
		treeFiles: allTreeFiles,
		vulnerabilityAlerts: (settled(vulnAlerts, null) ?? []).map((a) => ({
			severity: a.severity,
			state: a.state,
		})),
		ciiBadgeLevel,
		webhooks: settled(webhookData, null) ?? [],
		issueActivityCount: r.issues?.totalCount ?? 0,
		ossFuzzRegistered: settled(ossFuzzData, false),
		dockerfiles,
		contributors: contributorData,
		osvVulnerabilities,
		mergedPRCIResults,
		mergedPRSASTResults,
		successfulWorkflowPaths: (() => {
			const runs = settled(workflowRunsData, null);
			if (!runs?.workflow_runs) return [];
			const paths = new Set<string>();
			for (const run of runs.workflow_runs) {
				if (run.path && run.conclusion === "success") {
					paths.add(run.path);
				}
			}
			return [...paths];
		})(),
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

	const data = await assembleRepoData(client, owner, repo, fetchFn);
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
