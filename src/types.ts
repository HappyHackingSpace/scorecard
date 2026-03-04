export type RiskLevel = "Critical" | "High" | "Medium" | "Low";

export interface ScorecardOptions {
	token: string;
	checks?: string[];
	fetch?: typeof globalThis.fetch;
}

export interface ScorecardCheck {
	name: string;
	score: number;
	reason: string;
	details?: string[];
}

export interface ScorecardResult {
	date: string;
	repo: string;
	score: number;
	checks: ScorecardCheck[];
}

export interface CheckResult {
	score: number;
	reason: string;
	details?: string[];
}

export type CheckFn = (data: RepoData) => CheckResult;

export interface CheckDefinition {
	name: string;
	risk: RiskLevel;
	fn: CheckFn;
}

export interface BranchProtectionRule {
	allowsForcePushes: boolean;
	allowsDeletions: boolean;
	requiresApprovingReviews: boolean;
	requiredApprovingReviewCount: number;
	requiresStatusChecks: boolean;
	requiresCodeOwnerReviews: boolean;
	dismissesStaleReviews: boolean;
	isAdminEnforced: boolean;
}

export interface CommitInfo {
	message: string;
	committedDate: string;
	author: {
		login: string;
		organization: string | null;
	};
	associatedPullRequest: {
		merged: boolean;
		headSHA: string;
		reviews: number;
		labels: string[];
	} | null;
	statusCheckRollup: string | null;
}

export interface ReleaseAsset {
	name: string;
	downloadUrl: string;
}

export interface ReleaseInfo {
	tagName: string;
	createdAt: string;
	assets: ReleaseAsset[];
}

export interface WorkflowFile {
	path: string;
	content: string;
}

export interface RepoData {
	owner: string;
	repo: string;
	isArchived: boolean;
	pushedAt: string;
	createdAt: string;
	hasIssues: boolean;
	defaultBranch: string;
	licenseKey: string | null;
	licenseName: string | null;
	licenseUrl: string | null;
	isSecurityPolicyEnabled: boolean;
	securityPolicyContent: string | null;
	hasVulnerabilityAlertsEnabled: boolean;
	branchProtectionRules: BranchProtectionRule[];
	recentCommits: CommitInfo[];
	releases: ReleaseInfo[];
	workflowFiles: WorkflowFile[];
	hasDependabot: boolean;
	hasRenovate: boolean;
	treeFiles: string[];
	vulnerabilityAlerts: VulnerabilityAlert[];
	ciiBadgeLevel: string | null;
	webhooks: WebhookInfo[];
	issueActivityCount: number;
	spdxId: string | null;
	ossFuzzRegistered: boolean;
	successfulWorkflowPaths: string[];
	dockerfiles: { path: string; content: string }[];
	contributors: ContributorInfo[];
	osvVulnerabilities: OsvVulnerability[];
	mergedPRCIResults: { sha: string; hasCIChecks: boolean }[];
	mergedPRSASTResults: { sha: string; hasSASTCheck: boolean }[];
}

export interface ContributorInfo {
	login: string;
	contributions: number;
	organizations: string[];
	company: string | null;
}

export interface OsvVulnerability {
	id: string;
	severity: string;
}

export interface VulnerabilityAlert {
	severity: string;
	state: string;
}

export interface WebhookInfo {
	id: number;
	config: {
		secret?: string;
	};
	active: boolean;
}
