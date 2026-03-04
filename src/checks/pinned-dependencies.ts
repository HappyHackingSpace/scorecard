import type { CheckResult, RepoData } from "../types";

// OSSF: SHA pinning = 40+ hex chars (from checks/raw/pinned_dependencies.go)
const SHA_RE = /^[a-fA-F0-9]{40,}$/;
// Local action reference (./path) is always pinned
const LOCAL_ACTION_RE = /^\..+[^/]/;
// Docker Hub action pinned to sha256
const DOCKER_ACTION_PINNED_RE = /^docker:\/\/.*@sha256:[a-fA-F0-9]{64}$/;

// Dockerfile patterns
const DOCKER_FROM_RE = /^FROM\s+(\S+)/gm;
const DOCKER_DIGEST_RE = /@sha256:([a-f0-9]{64}|\$\{.*\})/;

// OSSF weighting: GitHub-owned=2, third-party=8, combined=10
const GITHUB_OWNED_PREFIXES = ["actions/", "github/"];
const GITHUB_OWNED_WEIGHT = 2;
const THIRD_PARTY_WEIGHT = 8;
const NORMAL_WEIGHT = 10;

// OSSF download utilities (from checks/raw/shell_download_validate.go)
// Pattern: curl/wget piped to shell interpreter
const FETCH_PIPE_EXEC_RE =
	/(?:curl|wget|gsutil)\s+[^\n]*\|\s*(?:sudo\s+)?(?:bash|sh|zsh|ksh|mksh|dash)/g;
// Pattern: process substitution bash <(curl ...)
const PROC_SUB_RE = /(?:bash|sh)\s+<\((?:curl|wget|gsutil)\s/g;

// OSSF: URL is only "pinned" if it's raw.githubusercontent.com with a 40-char SHA in path
const PINNED_URL_RE =
	/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[a-fA-F0-9]{40}\//;

// Package manager patterns in workflow run: blocks
// npm: npm install/i/ci/update - pinned only if npm ci
const NPM_INSTALL_RE = /\bnpm\s+(?:install|i|update|install-test)\b/g;
const NPM_CI_RE = /\bnpm\s+ci\b/;
// pip: pip/pip3 install - pinned if --require-hashes
const PIP_INSTALL_RE =
	/\b(?:pip3?|python3?\s+-m\s+pip)\s+install\b/g;
const PIP_HASHES_RE = /--require-hashes/;
// go: go install/get - pinned if has @vX.Y.Z or @sha
const GO_INSTALL_RE = /\bgo\s+(?:install|get)\s+\S+/g;
const GO_PINNED_RE = /@(?:v\d+\.\d+\.\d+|[a-fA-F0-9]{40,})\b/;
// choco: choco install - pinned if --requirechecksum(s)
const CHOCO_INSTALL_RE = /\bchoco(?:\.exe)?\s+install\b/g;
const CHOCO_PINNED_RE = /--require-?checksums?/;
// nuget: dotnet add package, dotnet restore, nuget install/restore, msbuild /t:restore
const NUGET_ADD_RE = /\bdotnet\s+add\s+(?:\S+\s+)?package\b/g;
const NUGET_ADD_PINNED_RE = /(?:-v|--version)\s/;
const DOTNET_RESTORE_RE = /\bdotnet\s+restore\b/g;
const DOTNET_RESTORE_PINNED_RE = /--locked-mode/;
const NUGET_RESTORE_RE = /\bnuget\s+restore\b/g;
const NUGET_RESTORE_PINNED_RE = /-LockedMode/;

// Extracts run: blocks from workflow YAML content
const RUN_BLOCK_RE = /^\s*-?\s*run:\s*[|>]\s*$/;
const RUN_INLINE_RE = /^\s*-?\s*run:\s*(.+)$/;

const extractRunBlocks = (content: string): string[] => {
	const blocks: string[] = [];
	const lines = content.split("\n");
	let inRun = false;
	let baseIndent = 0;
	let block = "";

	for (const line of lines) {
		if (RUN_BLOCK_RE.test(line)) {
			if (inRun && block.trim()) blocks.push(block);
			inRun = true;
			// Content of block literal must be indented more than the run: key
			baseIndent = line.search(/\S/) + (line.includes("- ") ? 2 : 0);
			block = "";
			continue;
		}
		const inlineMatch = !inRun && line.match(RUN_INLINE_RE);
		if (inlineMatch) {
			if (inRun && block.trim()) blocks.push(block);
			inRun = false;
			blocks.push(inlineMatch[1]);
			continue;
		}
		if (inRun) {
			if (line.trim() === "") {
				block += "\n";
			} else {
				const lineIndent = line.search(/\S/);
				if (lineIndent > baseIndent) {
					block += line + "\n";
				} else {
					if (block.trim()) blocks.push(block);
					inRun = false;
					block = "";
					// Re-check current line for new run: block
					if (RUN_BLOCK_RE.test(line)) {
						inRun = true;
						baseIndent = line.search(/\S/) + (line.includes("- ") ? 2 : 0);
						block = "";
					} else {
						const m = line.match(RUN_INLINE_RE);
						if (m) blocks.push(m[1]);
					}
				}
			}
		}
	}
	if (inRun && block.trim()) blocks.push(block);

	return blocks;
};

const isActionPinned = (actionUses: string): boolean => {
	if (LOCAL_ACTION_RE.test(actionUses)) return true;
	if (DOCKER_ACTION_PINNED_RE.test(actionUses)) return true;
	const atIdx = actionUses.lastIndexOf("@");
	if (atIdx === -1) return false;
	const ref = actionUses.slice(atIdx + 1);
	return SHA_RE.test(ref);
};

const isGitHubOwned = (action: string): boolean =>
	GITHUB_OWNED_PREFIXES.some((p) => action.startsWith(p));

interface WeightedBucket {
	pinned: number;
	total: number;
	weight: number;
}

export const pinnedDependencies = (data: RepoData): CheckResult => {
	const buckets: Record<string, WeightedBucket> = {};
	const details: string[] = [];

	const getBucket = (name: string, weight: number): WeightedBucket => {
		if (!buckets[name]) buckets[name] = { pinned: 0, total: 0, weight };
		return buckets[name];
	};

	let hasGitHubOwned = false;
	let hasThirdParty = false;

	// Pass 1: Detect which GH Action types exist (for weight assignment)
	for (const wf of data.workflowFiles) {
		const re = /uses:\s*(['"]?)([^\s'"]+)\1/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(wf.content)) !== null) {
			const action = m[2];
			if (LOCAL_ACTION_RE.test(action)) continue;
			if (isGitHubOwned(action)) hasGitHubOwned = true;
			else hasThirdParty = true;
		}
	}

	// OSSF edge case: if only one type exists, it gets weight 10
	const ghOwnedWeight = hasGitHubOwned && hasThirdParty ? GITHUB_OWNED_WEIGHT : NORMAL_WEIGHT;
	const thirdPartyWeight = hasGitHubOwned && hasThirdParty ? THIRD_PARTY_WEIGHT : NORMAL_WEIGHT;

	// Pass 2: Check GitHub Actions pinning
	for (const wf of data.workflowFiles) {
		const re = /uses:\s*(['"]?)([^\s'"]+)\1/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(wf.content)) !== null) {
			const action = m[2];
			if (LOCAL_ACTION_RE.test(action)) continue; // local always pinned, not counted

			const weight = isGitHubOwned(action) ? ghOwnedWeight : thirdPartyWeight;
			const bucketName = isGitHubOwned(action) ? "ghOwned" : "thirdParty";
			const b = getBucket(bucketName, weight);
			b.total++;

			if (isActionPinned(action)) {
				b.pinned++;
			} else {
				details.push(`${wf.path}: ${action} not pinned to SHA`);
			}
		}

		// Pass 3: Check run: blocks for package managers and insecure downloads
		const runBlocks = extractRunBlocks(wf.content);
		for (const block of runBlocks) {
			// Insecure downloads: curl/wget piped to shell
			const fetchPipes = block.match(FETCH_PIPE_EXEC_RE) ?? [];
			for (const fp of fetchPipes) {
				// Check if URL is pinned (raw.githubusercontent.com with SHA)
				if (!PINNED_URL_RE.test(fp)) {
					const b = getBucket("downloadThenRun", NORMAL_WEIGHT);
					b.total++;
					details.push(`${wf.path}: insecure download: ${fp.slice(0, 60)}`);
				}
			}

			// Process substitution: bash <(curl ...)
			const procSubs = block.match(PROC_SUB_RE) ?? [];
			for (const ps of procSubs) {
				if (!PINNED_URL_RE.test(ps)) {
					const b = getBucket("downloadThenRun", NORMAL_WEIGHT);
					b.total++;
					details.push(`${wf.path}: process substitution download: ${ps.slice(0, 60)}`);
				}
			}

			// npm install (unpinned unless npm ci)
			const npmMatches = block.match(NPM_INSTALL_RE) ?? [];
			if (npmMatches.length > 0 && !NPM_CI_RE.test(block)) {
				const b = getBucket("npmCommand", NORMAL_WEIGHT);
				b.total += npmMatches.length;
				details.push(`${wf.path}: unpinned npm install`);
			}

			// pip install (unpinned unless --require-hashes)
			const pipMatches = block.match(PIP_INSTALL_RE) ?? [];
			if (pipMatches.length > 0 && !PIP_HASHES_RE.test(block)) {
				const b = getBucket("pipCommand", NORMAL_WEIGHT);
				b.total += pipMatches.length;
				details.push(`${wf.path}: unpinned pip install`);
			}

			// go install/get (unpinned unless @vX.Y.Z or @SHA)
			const goMatches = block.match(GO_INSTALL_RE) ?? [];
			for (const gm of goMatches) {
				const b = getBucket("goCommand", NORMAL_WEIGHT);
				b.total++;
				if (GO_PINNED_RE.test(gm)) {
					b.pinned++;
				} else {
					details.push(`${wf.path}: unpinned go install`);
				}
			}

			// choco install (unpinned unless --requirechecksum)
			const chocoMatches = block.match(CHOCO_INSTALL_RE) ?? [];
			if (chocoMatches.length > 0 && !CHOCO_PINNED_RE.test(block)) {
				const b = getBucket("chocoCommand", NORMAL_WEIGHT);
				b.total += chocoMatches.length;
				details.push(`${wf.path}: unpinned choco install`);
			}

			// nuget: dotnet add package (unpinned unless -v/--version)
			const nugetAddMatches = block.match(NUGET_ADD_RE) ?? [];
			if (nugetAddMatches.length > 0 && !NUGET_ADD_PINNED_RE.test(block)) {
				const b = getBucket("nugetCommand", NORMAL_WEIGHT);
				b.total += nugetAddMatches.length;
			}

			// dotnet restore (unpinned unless --locked-mode)
			const dotnetRestoreMatches = block.match(DOTNET_RESTORE_RE) ?? [];
			if (dotnetRestoreMatches.length > 0 && !DOTNET_RESTORE_PINNED_RE.test(block)) {
				const b = getBucket("nugetCommand", NORMAL_WEIGHT);
				b.total += dotnetRestoreMatches.length;
			}

			// nuget restore (unpinned unless -LockedMode)
			const nugetRestoreMatches = block.match(NUGET_RESTORE_RE) ?? [];
			if (nugetRestoreMatches.length > 0 && !NUGET_RESTORE_PINNED_RE.test(block)) {
				const b = getBucket("nugetCommand", NORMAL_WEIGHT);
				b.total += nugetRestoreMatches.length;
			}
		}
	}

	// Pass 4: Dockerfile base image pinning (skip vendor/third_party)
	for (const df of data.dockerfiles) {
		if (/(?:^|\/)(?:vendor|third_party)\//.test(df.path)) continue;

		const fromRe = new RegExp(DOCKER_FROM_RE.source, "gm");
		const pinnedAliases = new Set<string>();
		let m: RegExpExecArray | null;

		while ((m = fromRe.exec(df.content)) !== null) {
			const image = m[1];
			if (image === "scratch") continue;
			if (image.startsWith("$")) continue;

			// Check if FROM ... AS alias was previously pinned
			const asMatch = m[0].match(/\s+[Aa][Ss]\s+(\S+)/);
			if (pinnedAliases.has(image)) {
				// Referencing a previously pinned alias — pinned
				if (asMatch) pinnedAliases.add(asMatch[1]);
				continue;
			}

			const b = getBucket("containerImage", NORMAL_WEIGHT);
			b.total++;

			if (DOCKER_DIGEST_RE.test(image)) {
				b.pinned++;
				if (asMatch) pinnedAliases.add(asMatch[1]);
			} else {
				details.push(`${df.path}: ${image} not pinned to digest`);
			}
		}
	}

	// Compute weighted proportional score (OSSF CreateProportionalScoreWeighted)
	let weightedSuccess = 0;
	let weightedTotal = 0;

	for (const b of Object.values(buckets)) {
		if (b.total === 0) continue;
		weightedSuccess += b.pinned * b.weight;
		weightedTotal += b.total * b.weight;
	}

	if (weightedTotal === 0) {
		return { score: -1, reason: "No dependencies to evaluate" };
	}

	const score = Math.min(Math.floor((10 * weightedSuccess) / weightedTotal), 10);

	return {
		score,
		reason: `Dependency pinning score: ${score}/10`,
		details: details.slice(0, 10),
	};
};
