import type { UnboundLogEntry, UnboundLogSource } from '@unbound-app/types';

/** The Logs page's source segments. */
export const LOG_SEGMENTS = ['all', 'js', 'react-native', 'native'] as const;

export type LogSegment = (typeof LOG_SEGMENTS)[number];

/** What the Logs page shows: a source segment, Unbound's lines alone, and a search. */
export type LogFilter = {
	segment: LogSegment;
	unboundOnly: boolean;
	search: string;
};

// The JS segment holds Unbound's lines too: both come from the JS runtime.
const SEGMENT_SOURCES: Record<LogSegment, readonly UnboundLogSource[]> = {
	all: ['unbound', 'js', 'react-native', 'native'],
	js: ['unbound', 'js'],
	'react-native': ['react-native'],
	native: ['native'],
};

/**
 * @description Keeps the entries a filter shows, searching the message and scope case-insensitively.
 * @template T The entry type.
 * @param entries The entries.
 * @param filter The segment, Unbound-only switch and search.
 * @returns The matching entries, in their order.
 */
export function filterLogEntries<T extends UnboundLogEntry>(entries: T[], filter: LogFilter): T[] {
	const sources = SEGMENT_SOURCES[filter.segment];
	const query = filter.search.trim().toLowerCase();

	return entries.filter(
		(entry) =>
			sources.includes(entry.src) &&
			(!filter.unboundOnly || entry.src === 'unbound') &&
			(!query ||
				entry.msg.toLowerCase().includes(query) ||
				entry.scope.some((part) => part.toLowerCase().includes(query))),
	);
}
