import { MARKETPLACE_TABS } from '~/ui/marketplace';
import type { UpdatableKind } from '~/lib/updates';
import { Moment } from '~/api/metro/common';
import { Icons } from '~/api/assets';

/**
 * @description Resolves the asset that stands in for an addon's own icon, by its kind.
 * @param kind The manager the addon belongs to.
 * @returns The asset id.
 */
export function kindIcon(kind: UpdatableKind): number | undefined {
	return Icons[MARKETPLACE_TABS.find((tab) => tab.kind === kind)?.icon ?? 'PuzzlePieceIcon'];
}

/**
 * @description Formats a past time relative to now in the active locale, like "2 minutes ago".
 * @param date An ISO timestamp.
 * @returns The relative time.
 */
export function fromNow(date: string): string {
	return Moment.utc(date).fromNow();
}

/**
 * @description Picks a changelog's first line of prose, dropping Markdown heading and list markers.
 * @param changelog The changelog text.
 * @returns The line, or `undefined` when the changelog is empty.
 */
export function headline(changelog: string | null): string | undefined {
	return changelog
		?.split('\n')
		.map((text) => text.replace(/^\s*(?:#+|[-*+]|\d+\.)\s*/, '').trim())
		.find(Boolean);
}

/**
 * @description Formats a release date compactly in the active locale, like "Oct 19", so it fits as trailing text.
 * @param date An ISO timestamp.
 * @returns The short date.
 */
export function shortDate(date: string): string {
	return Moment.utc(date)
		.local()
		.format('ll')
		.replace(/,? \d{4}$/, '');
}

export default { kindIcon, fromNow, shortDate, headline };
