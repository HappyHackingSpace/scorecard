import type { CheckResult, RepoData } from "../types";

const DANGEROUS_TRIGGERS = ["pull_request_target"];
const SCRIPT_INJECTION_PATTERNS = [
	/\$\{\{\s*github\.event\.pull_request\.title\s*\}\}/,
	/\$\{\{\s*github\.event\.pull_request\.body\s*\}\}/,
	/\$\{\{\s*github\.event\.issue\.title\s*\}\}/,
	/\$\{\{\s*github\.event\.issue\.body\s*\}\}/,
	/\$\{\{\s*github\.event\.comment\.body\s*\}\}/,
	/\$\{\{\s*github\.event\.review\.body\s*\}\}/,
	/\$\{\{\s*github\.head_ref\s*\}\}/,
];

export const dangerousWorkflow = (data: RepoData): CheckResult => {
	if (data.workflowFiles.length === 0) {
		return { score: -1, reason: "No workflow files found" };
	}

	const details: string[] = [];

	for (const wf of data.workflowFiles) {
		for (const trigger of DANGEROUS_TRIGGERS) {
			if (wf.content.includes(trigger)) {
				// biome-ignore lint/suspicious/noTemplateCurlyInString: matching GitHub Actions expression syntax
				const prHeadSha = "ref: ${{ github.event.pull_request.head.sha }}";
				// biome-ignore lint/suspicious/noTemplateCurlyInString: matching GitHub Actions expression syntax
				const headRef = "ref: ${{ github.head_ref }}";
				const hasCheckout =
					wf.content.includes("actions/checkout") &&
					(wf.content.includes(prHeadSha) || wf.content.includes(headRef));

				if (hasCheckout) {
					details.push(`${wf.path}: ${trigger} with explicit checkout`);
				}
			}
		}

		for (const pattern of SCRIPT_INJECTION_PATTERNS) {
			if (pattern.test(wf.content)) {
				details.push(`${wf.path}: potential script injection with ${pattern.source}`);
				return { score: 0, reason: "Dangerous workflow patterns detected", details };
			}
		}
	}

	if (details.length > 0) {
		return { score: 5, reason: "Potentially dangerous workflow patterns", details };
	}

	return { score: 10, reason: "No dangerous workflow patterns detected" };
};
