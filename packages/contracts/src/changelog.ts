import { z } from 'zod';

import { semverSchema } from './manifest';

/** The change types a release lists, in the order its sections are kept. */
export const changeTypeSchema = z.enum(['added', 'changed', 'fixed', 'removed']);

/** One `### Type` block. Items are plain text; a type this client does not know reads as `changed`. */
export const changelogSectionSchema = z.object({
	type: changeTypeSchema.catch('changed'),
	items: z.array(z.string().min(1).max(500)).min(1).max(50),
});

/** One release's entry: its date and its sections, in `changeTypeSchema` order, each type at most once. */
export const changelogSchema = z.object({
	date: z.iso.date().nullable(),
	sections: z.array(changelogSectionSchema).max(changeTypeSchema.options.length),
});

/** A version's changelog on the wire: parsed sections for sourced versions, free text for legacy ones. */
export const versionChangelogSchema = z.discriminatedUnion('format', [
	changelogSchema.extend({ format: z.literal('sections') }),
	z.object({ format: z.literal('text'), text: z.string() }),
]);

export type ChangeType = z.infer<typeof changeTypeSchema>;
export type ChangelogSection = z.infer<typeof changelogSectionSchema>;
export type Changelog = z.infer<typeof changelogSchema>;
export type VersionChangelog = z.infer<typeof versionChangelogSchema>;

/** A problem on one 1-based line of the file. */
export type ChangelogIssue = {
	line: number;
	message: string;
};

/** Every release found, keyed by version, and every issue in the file. */
export type ParsedChangelog = {
	releases: Map<string, Changelog>;
	issues: ChangelogIssue[];
};

const MAX_ITEMS = 50;
const MAX_ITEM_LENGTH = 500;
const SECTION_NAMES = 'Added, Changed, Fixed or Removed';

const FOLDED_HEADINGS: Record<string, string> = {
	security: 'Fixed',
	deprecated: 'Changed',
};

const RELEASE_HEADING = /^(?:\[([^\]]+)\]|([^\s[\]]+))(?:\s+-\s+(\S+))?$/;
const LINK_DEFINITION = /^\[[^\]]+\]:\s*\S+/;
const BULLET = /^[-*](?:\s+(.*))?$/;
const ISO_DATE = z.iso.date();

type Item = {
	line: number;
	text: string;
};

type OpenSection = {
	line: number;
	heading: string;
	type: ChangeType | undefined;
	items: Item[];
};

type OpenRelease = {
	version: string;
	date: string | null;
	keep: boolean;
	sections: Map<ChangeType, string[]>;
};

type Parser = {
	issues: ChangelogIssue[];
	releases: Map<string, Changelog>;
	versionLines: Map<string, number>;
	block: 'preamble' | 'unreleased' | 'release';
	release: OpenRelease | undefined;
	section: OpenSection | undefined;
	inItem: boolean;
};

/**
 * @description Parses a `CHANGELOG.md`, collecting every issue instead of stopping at the first. Never throws.
 * @param text The file's text.
 * @returns The well-formed releases keyed by version, and every issue with its line.
 */
export function parseChangelog(text: string): ParsedChangelog {
	const parser: Parser = {
		issues: [],
		releases: new Map(),
		versionLines: new Map(),
		block: 'preamble',
		release: undefined,
		section: undefined,
		inItem: false,
	};

	const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

	for (let i = 0, len = lines.length; i < len; i++) {
		parseLine(parser, lines[i] ?? '', i + 1);
	}

	closeRelease(parser);
	parser.issues.sort((a, b) => a.line - b.line);

	return { releases: parser.releases, issues: parser.issues };
}

/**
 * @description Picks one version's entry out of a parsed changelog.
 * @param parsed The parsed changelog.
 * @param version The version to look up.
 * @returns The entry, or `undefined` when the changelog does not list that version.
 */
export function selectRelease(parsed: ParsedChangelog, version: string): Changelog | undefined {
	return parsed.releases.get(version);
}

/**
 * @description Renders issues one per line as `CHANGELOG.md:12: message`.
 * @param issues The issues, in line order.
 * @param file The file path shown to the user.
 * @returns The rendered issues.
 */
export function formatChangelogIssues(
	issues: ChangelogIssue[],
	file: string = 'CHANGELOG.md',
): string {
	return issues.map((issue) => `${file}:${issue.line}: ${issue.message}`).join('\n');
}

function parseLine(parser: Parser, raw: string, line: number) {
	const text = raw.trimEnd();

	if (text.startsWith('## ') || text === '##') {
		closeRelease(parser);
		openRelease(parser, text.slice(2).trim(), line);

		return;
	}

	if (parser.block !== 'release') return;

	const wasInItem = parser.inItem;

	parser.inItem = false;

	if (text === '' || LINK_DEFINITION.test(text)) return;

	if (text.startsWith('### ') || text === '###') {
		closeSection(parser);
		openSection(parser, text.slice(3).trim(), line);

		return;
	}

	if (/^\s/.test(text)) {
		continueItem(parser, text.trim(), line, wasInItem);

		return;
	}

	const bullet = BULLET.exec(text);

	if (bullet) {
		addItem(parser, bullet[1] ?? '', line);

		return;
	}

	addIssue(parser, line, 'Only ### headings and - bullets may follow a release heading.');
}

function openRelease(parser: Parser, heading: string, line: number) {
	if (/^\[?unreleased\]?$/i.test(heading)) {
		parser.block = 'unreleased';

		return;
	}

	parser.block = 'release';

	const match = RELEASE_HEADING.exec(heading);
	const version = match?.[1] ?? match?.[2] ?? heading;
	const date = match?.[3] ?? null;

	let keep = true;

	if (!match) {
		keep = false;
		addIssue(
			parser,
			line,
			`Write a release heading as "## [1.2.0] - 2026-05-01", not "## ${heading}".`,
		);
	} else if (!semverSchema.safeParse(version).success) {
		keep = false;
		addIssue(parser, line, `"${version}" is not a semver version.`);
	} else if (date !== null && !ISO_DATE.safeParse(date).success) {
		keep = false;
		addIssue(parser, line, `"${date}" is not a date in YYYY-MM-DD form.`);
	}

	const previous = parser.versionLines.get(version);

	if (keep && previous !== undefined) {
		keep = false;
		addIssue(parser, line, `Version ${version} is already listed on line ${previous}.`);
	}

	if (keep) {
		parser.versionLines.set(version, line);
	}

	parser.release = { version, date, keep, sections: new Map() };
}

function closeRelease(parser: Parser) {
	closeSection(parser);

	const { release } = parser;

	parser.release = undefined;
	parser.inItem = false;

	if (!release?.keep) return;

	const sections: ChangelogSection[] = [];

	for (const type of changeTypeSchema.options) {
		const items = release.sections.get(type);

		if (items) {
			sections.push({ type, items });
		}
	}

	parser.releases.set(release.version, { date: release.date, sections });
}

function openSection(parser: Parser, heading: string, line: number) {
	const name = heading.toLowerCase();
	const parsed = changeTypeSchema.safeParse(name);
	const folded = FOLDED_HEADINGS[name];

	let type: ChangeType | undefined;

	if (folded) {
		addIssue(parser, line, `List ${heading} changes under ### ${folded}.`);
	} else if (!parsed.success) {
		addIssue(parser, line, `Unknown section "${heading}". Use ${SECTION_NAMES}.`);
	} else if (parser.release?.sections.has(parsed.data)) {
		addIssue(parser, line, `### ${heading} appears twice in this release.`);
	} else {
		type = parsed.data;
		parser.release?.sections.set(type, []);
	}

	parser.section = { line, heading, type, items: [] };
}

function closeSection(parser: Parser) {
	const { section, release } = parser;

	parser.section = undefined;

	if (!section?.type) return;

	if (section.items.length === 0) {
		addIssue(parser, section.line, `### ${section.heading} has no items.`);
	}

	const kept = release?.sections.get(section.type);

	for (const item of section.items.slice(0, MAX_ITEMS)) {
		if (item.text.length > MAX_ITEM_LENGTH) {
			addIssue(parser, item.line, `This item is over ${MAX_ITEM_LENGTH} characters.`);
		} else {
			kept?.push(item.text);
		}
	}
}

function addItem(parser: Parser, text: string, line: number) {
	const { section } = parser;

	if (!section) {
		addIssue(parser, line, `Put this item under a ### ${SECTION_NAMES} heading.`);

		return;
	}

	if (text.trim() === '') {
		addIssue(parser, line, 'This item is empty.');

		return;
	}

	parser.inItem = true;

	if (section.items.length === MAX_ITEMS) {
		addIssue(parser, line, `### ${section.heading} has more than ${MAX_ITEMS} items.`);
	}

	section.items.push({ line, text: text.trim() });
}

function continueItem(parser: Parser, text: string, line: number, wasInItem: boolean) {
	const item = parser.section?.items.at(-1);

	if (BULLET.test(text)) {
		addIssue(
			parser,
			line,
			'Nested lists are not supported; write each item as its own bullet.',
		);

		return;
	}

	if (!wasInItem || !item) {
		addIssue(parser, line, 'An indented line must continue the bullet directly above it.');

		return;
	}

	parser.inItem = true;
	item.text = `${item.text} ${text}`;
}

function addIssue(parser: Parser, line: number, message: string) {
	parser.issues.push({ line, message });
}

export default {
	changeTypeSchema,
	changelogSectionSchema,
	changelogSchema,
	versionChangelogSchema,
	parseChangelog,
	selectRelease,
	formatChangelogIssues,
};
