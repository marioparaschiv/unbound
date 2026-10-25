import type { ChangeType, Changelog } from '../../contracts/src/changelog';
import { CHANGE_LABELS, changeTypeSchema, parseChangelog } from '../../contracts/src/changelog';

/** One commit that touched a plugin, as `git log` reports it. */
export type PluginCommit = {
	sha: string;
	subject: string;
	body: string;
};

export type ReleaseInput = {
	/** Newest first. */
	commits: PluginCommit[];
	/** `YYYY-MM-DD`. */
	date: string;
	/** The plugin has never been published. */
	firstRelease: boolean;
};

type CommitChange = {
	type: ChangeType;
	item: string;
};

const MAX_ITEMS = 50;
const MAX_ITEM_LENGTH = 500;
const CONVENTIONAL_HEADER = /^([a-z]+)(?:\([^)]*\))?!?:\s+(\S.*)$/i;
const RELEASE_HEADING = /^##(?:\s|$)/;
const UNRELEASED_HEADING = /^##\s+\[?unreleased\]?\s*$/i;

/** The commit types a release lists; every other type is left out. */
const CHANGE_TYPES: Record<string, ChangeType> = {
	feat: 'added',
	fix: 'fixed',
	perf: 'changed',
};

const MAINTENANCE_ITEM = 'Maintenance release with no user-facing changes.';
const INITIAL_ITEM = 'Initial release.';

/**
 * @description Builds a release's changelog entry from the conventional commits since the last release.
 * @param input The commits, the release date and whether this is the plugin's first release.
 * @returns The entry, with one default item when no commit qualifies.
 */
export function createRelease(input: ReleaseInput): Changelog {
	const items = new Map<ChangeType, Set<string>>();

	for (const commit of input.commits) {
		const change = parseCommit(commit.subject);

		if (!change) {
			continue;
		}

		const section = items.get(change.type) ?? new Set<string>();

		items.set(change.type, section);

		if (section.size < MAX_ITEMS) {
			section.add(change.item);
		}
	}

	const sections = changeTypeSchema.options
		.filter((type) => items.has(type))
		.map((type) => ({ type, items: [...(items.get(type) ?? [])] }));

	if (sections.length > 0) {
		return { date: input.date, sections };
	}

	return {
		date: input.date,
		sections: input.firstRelease
			? [{ type: 'added', items: [INITIAL_ITEM] }]
			: [{ type: 'changed', items: [MAINTENANCE_ITEM] }],
	};
}

/**
 * @description Renders one release as the markdown `parseChangelog` reads.
 * @param version The release's version.
 * @param changelog The release's entry.
 * @returns The release heading and its sections, ending in a newline.
 */
export function renderRelease(version: string, changelog: Changelog): string {
	const heading = changelog.date ? `## [${version}] - ${changelog.date}` : `## [${version}]`;
	const blocks = changelog.sections.map((section) =>
		[
			`### ${CHANGE_LABELS[section.type]}`,
			'',
			...section.items.map((item) => `- ${item}`),
		].join('\n'),
	);

	return `${[heading, ...blocks].join('\n\n')}\n`;
}

/**
 * @description Adds a release to a `CHANGELOG.md` above its newest release. An entry already written for that version wins.
 * @param existing The file's text, or `undefined` when the plugin has none.
 * @param version The release's version.
 * @param changelog The release's generated entry.
 * @returns The file's new text; `existing` itself when it already lists the version.
 */
export function mergeRelease(
	existing: string | undefined,
	version: string,
	changelog: Changelog,
): string {
	const entry = renderRelease(version, changelog);

	if (existing === undefined) {
		return `# Changelog\n\n${entry}`;
	}

	if (parseChangelog(existing).releases.has(version)) {
		return existing;
	}

	const lines = existing.split('\n');
	const index = lines.findIndex(
		(line) => RELEASE_HEADING.test(line) && !UNRELEASED_HEADING.test(line.trimEnd()),
	);

	if (index === -1) {
		const body = existing.trimEnd();

		return body === '' ? `# Changelog\n\n${entry}` : `${body}\n\n${entry}`;
	}

	return [...lines.slice(0, index), entry, ...lines.slice(index)].join('\n');
}

function parseCommit(subject: string): CommitChange | undefined {
	const match = CONVENTIONAL_HEADER.exec(subject.trim());
	const type = CHANGE_TYPES[match?.[1]?.toLowerCase() ?? ''];
	const description = match?.[2]?.trim();

	if (!type || !description) return;

	return { type, item: toItem(description) };
}

function toItem(description: string): string {
	const item = description.charAt(0).toUpperCase() + description.slice(1);

	if (item.length <= MAX_ITEM_LENGTH) {
		return item;
	}

	return `${item.slice(0, MAX_ITEM_LENGTH - 1).trimEnd()}…`;
}

export default {
	createRelease,
	renderRelease,
	mergeRelease,
};
