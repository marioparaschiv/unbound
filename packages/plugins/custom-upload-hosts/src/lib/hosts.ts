export type HostSettings = {
	host: string;
	litterboxExpiry: string;
	customUrl: string;
	customFileField: string;
	customFields: string;
	customHeaders: string;
	customResponse: string;
	customJsonPath: string;
};

export type Response = { response: 'text' | 'json'; jsonPath?: string };

export type Host = Response & {
	url: string;
	fileField: string;
	fields: Record<string, string>;
	headers: Record<string, string>;
};

const HTTP = /^https?:\/\/\S+$/i;

/**
 * @description Reads lines of `key=value` or `Name: value` pairs, skipping blank and broken lines.
 * @param text The lines.
 * @param separator What splits a key from its value.
 * @returns The pairs, trimmed.
 */
export function parseLines(text: string, separator: string): Record<string, string> {
	return Object.fromEntries(
		text
			.split('\n')
			.map((line) => line.split(separator))
			.filter((parts) => parts.length > 1 && parts[0]!.trim())
			.map(([key, ...value]) => [key!.trim(), value.join(separator).trim()]),
	);
}

/**
 * @description Describes the upload host the settings pick: Catbox, Litterbox with its expiry, or a custom host.
 * @param settings The plugin's settings.
 * @returns The host, or `undefined` when the custom host has no http address.
 */
export function hostFor(settings: HostSettings): Host | undefined {
	if (settings.host === 'litterbox') {
		return {
			url: 'https://litterbox.catbox.moe/resources/internals/api.php',
			fileField: 'fileToUpload',
			fields: { reqtype: 'fileupload', time: settings.litterboxExpiry },
			headers: {},
			response: 'text',
		};
	}

	if (settings.host !== 'custom') {
		return {
			url: 'https://catbox.moe/user/api.php',
			fileField: 'fileToUpload',
			fields: { reqtype: 'fileupload' },
			headers: {},
			response: 'text',
		};
	}

	const url = settings.customUrl.trim();

	if (!HTTP.test(url)) return undefined;

	return {
		url,
		fileField: settings.customFileField.trim() || 'file',
		fields: parseLines(settings.customFields, '='),
		headers: parseLines(settings.customHeaders, ':'),
		response: settings.customResponse === 'json' ? 'json' : 'text',
		...(settings.customResponse === 'json' ? { jsonPath: settings.customJsonPath.trim() } : {}),
	};
}

function valueAt(value: unknown, path: string): unknown {
	return path
		.split('.')
		.filter(Boolean)
		.reduce<unknown>(
			(current, key) => (current as Record<string, unknown> | null | undefined)?.[key],
			value,
		);
}

/**
 * @description Reads the uploaded file's link from the host's answer: the whole text, or a value at a dot path in JSON.
 * @param body The answer's text.
 * @param response How the host answers.
 * @returns The link, or `undefined` when the answer holds no http link.
 */
export function readLink(body: string, { response, jsonPath }: Response): string | undefined {
	let link: unknown = body.trim();

	if (response === 'json') {
		try {
			link = valueAt(JSON.parse(body), jsonPath ?? '');
		} catch {
			// A host that answers with an error page instead of JSON gave no link.
			return undefined;
		}
	}

	return typeof link === 'string' && HTTP.test(link.trim()) ? link.trim() : undefined;
}

export default { hostFor, parseLines, readLink };
