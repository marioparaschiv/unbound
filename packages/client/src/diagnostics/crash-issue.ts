import { REPOSITORY } from '~/core/repository';

import type { CrashIssueLink, CrashRecord } from './crash-history';
import type { IssueDraft } from './issue-report';

const SEARCH_TERM_LENGTH = 80;
const TITLE_MESSAGE_LENGTH = 100;

type SearchItem = { number: number; html_url: string; pull_request?: unknown };

type SearchResponse = { items: SearchItem[] };

function isSearchItem(value: unknown): value is SearchItem {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const item = value as Partial<SearchItem>;

	return typeof item.number === 'number' && typeof item.html_url === 'string';
}

/**
 * @description Tells whether a GitHub issue search answered with a list of issues.
 * @param value The parsed response body.
 * @returns Whether it has an `items` array of issues.
 */
export function isSearchResponse(value: unknown): value is SearchResponse {
	return (
		Boolean(value) &&
		typeof value === 'object' &&
		Array.isArray((value as Partial<SearchResponse>).items) &&
		(value as SearchResponse).items.every(isSearchItem)
	);
}

/**
 * @description Picks the part of a crash's message that identifies it on GitHub: its first line, without quotes,
 * which GitHub's search syntax would read as its own.
 * @param message The crash's message.
 * @returns The phrase to search for, or an empty string when the message has none.
 */
export function crashSearchTerm(message: string): string {
	const [firstLine = ''] = message.split('\n');

	return firstLine.replaceAll('"', '').trim().slice(0, SEARCH_TERM_LENGTH);
}

/**
 * @description Builds the GitHub search that finds open issues mentioning a crash.
 * @param record The crash.
 * @returns The search API URL, or `undefined` when the message gives nothing to search for.
 */
export function crashSearchURL(record: CrashRecord): string | undefined {
	const term = crashSearchTerm(record.message);

	if (!term) {
		return undefined;
	}

	const query = `repo:${REPOSITORY} is:issue is:open in:title,body "${term}"`;

	return `https://api.github.com/search/issues?per_page=1&q=${encodeURIComponent(query)}`;
}

/**
 * @description Finds an open GitHub issue that already mentions a crash's message.
 * @param record The crash.
 * @returns The issue, or `undefined` when none mentions it or GitHub could not be asked.
 */
export async function findCrashIssue(record: CrashRecord): Promise<CrashIssueLink | undefined> {
	const url = crashSearchURL(record);

	if (!url) {
		return undefined;
	}

	const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
	const body: unknown = response.ok ? await response.json() : undefined;
	const [issue] = isSearchResponse(body) ? body.items.filter((item) => !item.pull_request) : [];

	return issue ? { number: issue.number, url: issue.html_url } : undefined;
}

/**
 * @description Writes the title and log section a bug report for a crash starts with.
 * @param record The crash.
 * @param pluginName The name of the plugin the crash blamed, if any.
 * @returns The title and logs.
 */
export function crashIssueDraft(
	record: CrashRecord,
	pluginName: string | undefined,
): Required<IssueDraft> {
	const [firstLine = record.kind] = record.message.split('\n');
	const owner = pluginName ? ` (${pluginName})` : '';

	return {
		title: `crash${owner}: ${firstLine.slice(0, TITLE_MESSAGE_LENGTH)}`,
		logs: [
			`Kind: ${record.kind}`,
			`When: ${new Date(record.at).toISOString()}`,
			...(record.addon ? [`Plugin: ${record.addon}`] : []),
			...(record.reportId ? [`Report: ${record.reportId}`] : []),
			'',
			record.message,
		].join('\n'),
	};
}
