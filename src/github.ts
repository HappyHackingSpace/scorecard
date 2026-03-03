const GITHUB_API = "https://api.github.com";
const GITHUB_GRAPHQL = "https://api.github.com/graphql";

export interface GitHubClientOptions {
	token: string;
	fetch: typeof globalThis.fetch;
}

const buildHeaders = (token: string): Record<string, string> => ({
	Authorization: `Bearer ${token}`,
	Accept: "application/vnd.github+json",
	"X-GitHub-Api-Version": "2022-11-28",
});

export const graphql = async <T>(
	options: GitHubClientOptions,
	query: string,
	variables: Record<string, unknown>,
): Promise<T> => {
	const response = await options.fetch(GITHUB_GRAPHQL, {
		method: "POST",
		headers: { ...buildHeaders(options.token), "Content-Type": "application/json" },
		body: JSON.stringify({ query, variables }),
	});

	if (!response.ok) {
		throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
	}

	const json = (await response.json()) as { data?: T; errors?: { message: string }[] };

	if (json.errors?.length) {
		throw new Error(`GraphQL errors: ${json.errors.map((e) => e.message).join(", ")}`);
	}

	if (!json.data) {
		throw new Error("GraphQL response missing data");
	}

	return json.data;
};

export const restGet = async <T>(options: GitHubClientOptions, path: string): Promise<T | null> => {
	const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
	const response = await options.fetch(url, { headers: buildHeaders(options.token) });

	if (response.status === 404 || response.status === 403) {
		return null;
	}

	if (!response.ok) {
		throw new Error(`REST request failed: ${response.status} ${response.statusText}`);
	}

	return (await response.json()) as T;
};

export const restGetRaw = async (
	options: GitHubClientOptions,
	path: string,
): Promise<string | null> => {
	const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
	const response = await options.fetch(url, {
		headers: { ...buildHeaders(options.token), Accept: "application/vnd.github.raw+json" },
	});

	if (response.status === 404 || response.status === 403) {
		return null;
	}

	if (!response.ok) {
		throw new Error(`REST request failed: ${response.status} ${response.statusText}`);
	}

	return response.text();
};
