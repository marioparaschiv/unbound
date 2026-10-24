/**
 * @description Reads the query parameters of a URL by hand, since `URL`'s query support differs across React Native versions.
 * @param location The URL to read.
 * @returns The decoded parameters; the first value wins for a repeated key.
 */
export function readQuery(location: string): Record<string, string> {
	const query = location.split('#')[0]?.split('?')[1] ?? '';
	const params: Record<string, string> = {};

	for (const pair of query.split('&')) {
		const [key = '', value = ''] = pair.split('=');
		const name = decodeURIComponent(key);

		if (name && !(name in params)) {
			params[name] = decodeURIComponent(value.replace(/\+/g, ' '));
		}
	}

	return params;
}

export default readQuery;
