export type FetchJson = <T>(url: string) => Promise<T>;

/**
 * @description Builds an API URL with its query, skipping empty values.
 * @param base The endpoint, such as `https://api.tenor.com/v1/search`.
 * @param params The query parameters.
 * @returns The full URL.
 */
export function buildUrl(base: string, params: Record<string, string | undefined>): string {
	const search = new URLSearchParams();

	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== '') search.set(key, value);
	}

	return `${base}?${search.toString()}`;
}

/**
 * @description Fetches a URL and parses its JSON body.
 * @param url The URL to request.
 * @returns The parsed body.
 * @throws When the request fails or answers with an error status.
 */
export async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`GET ${new URL(url).pathname} failed with status ${response.status}`);
	}

	return (await response.json()) as T;
}
