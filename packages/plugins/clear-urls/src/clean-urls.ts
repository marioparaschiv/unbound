type HostRules = {
	host: RegExp;
	params: RegExp[];
};

export type Rules = {
	universal: RegExp[];
	hosts: HostRules[];
};

function escape(text: string): string {
	return text.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function paramPattern(param: string): RegExp {
	return new RegExp(`^${escape(param).replace('\\*', '.+?')}$`);
}

function hostPattern(host: string): RegExp {
	const pattern = escape(host)
		.replace(/^\\\*\\\./, '(.+?\\.)?')
		.replace('\\*', '.+?');

	return new RegExp(`^(www\\.)?${pattern}$`);
}

/**
 * @description Compiles rules written as `param` or `param@host`, where `*` matches any run of characters.
 * @param rules The rules, such as `utm_source`, `pd_rd_*@amazon.*` or `t@*.twitter.com`.
 * @returns Rules for every URL, and rules grouped by the host they apply to.
 */
export function compileRules(rules: string[]): Rules {
	const universal: RegExp[] = [];
	const hosts = new Map<string, HostRules>();

	for (const rule of rules) {
		const [param, host] = rule.split('@');
		const pattern = paramPattern(param);

		if (!host) {
			universal.push(pattern);

			continue;
		}

		const hostRule = hostPattern(host);
		const group = hosts.get(hostRule.source);

		if (group) {
			group.params.push(pattern);
		} else {
			hosts.set(hostRule.source, { host: hostRule, params: [pattern] });
		}
	}

	return { universal, hosts: [...hosts.values()] };
}

function parseUrl(text: string): URL | null {
	try {
		return new URL(text);
	} catch {
		return null;
	}
}

function removeParams(params: URLSearchParams, pattern: RegExp) {
	// Iterate a copy: deleting while iterating `params` skips the next entry.
	for (const param of [...params.keys()]) {
		if (pattern.test(param)) params.delete(param);
	}
}

function cleanUrl(text: string, rules: Rules): string {
	const url = parseUrl(text);

	// A URL without a query is returned untouched, so it is not reformatted by `URL`.
	if (!url || url.searchParams.keys().next().done) return text;

	for (const pattern of rules.universal) removeParams(url.searchParams, pattern);

	for (const { host, params } of rules.hosts) {
		if (!host.test(url.hostname)) continue;

		for (const pattern of params) removeParams(url.searchParams, pattern);
	}

	return url.toString();
}

/**
 * @description Removes tracking parameters from every link in a message.
 * @param content The message content.
 * @param rules Rules compiled with {@link compileRules}.
 * @returns The content with each link's tracking parameters removed.
 */
export function cleanUrls(content: string, rules: Rules): string {
	return content.replace(/https?:\/\/[^\s<]+[^<.,:;"'>)|\]\s]/g, (url) => cleanUrl(url, rules));
}

export default { compileRules, cleanUrls };
