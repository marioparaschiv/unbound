import { safeParse, Type, type StaticDecode } from './schema';
import { semverSchema } from './manifest';

/** The change types a release lists, in the order its sections are kept. */
export const CHANGE_TYPES = ['added', 'changed', 'fixed', 'removed'] as const;

export const changeTypeSchema = Type.Enum(CHANGE_TYPES);

/** An unknown type reads as `changed`, so an older client keeps rendering a newer changelog. */
const changeTypeValueSchema = Type.Codec(Type.Any())
	.Decode((value): ChangeType => {
		const parsed = safeParse(changeTypeSchema, value);

		return parsed.success ? parsed.data : 'changed';
	})
	.Encode((value) => value);

/** One `### Type` block. Items are plain text; a type this client does not know reads as `changed`. */
export const changelogSectionSchema = Type.Object({
	type: changeTypeValueSchema,
	items: Type.Array(Type.String({ minLength: 1, maxLength: 500 }), { minItems: 1, maxItems: 50 }),
});

/** One release's entry: its date and its sections, in `changeTypeSchema` order, each type at most once. */
export const changelogSchema = Type.Object({
	date: Type.Union([Type.String({ format: 'date' }), Type.Null()]),
	sections: Type.Array(changelogSectionSchema, { maxItems: CHANGE_TYPES.length }),
});

export type ChangeType = StaticDecode<typeof changeTypeSchema>;
export type ChangelogSection = StaticDecode<typeof changelogSectionSchema>;
export type Changelog = StaticDecode<typeof changelogSchema>;

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

/** The heading each change type is written under. */
export const CHANGE_LABELS: Record<ChangeType, string> = {
	added: 'Added',
	changed: 'Changed',
	fixed: 'Fixed',
	removed: 'Removed',
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
const ISO_DATE = Type.String({ format: 'date' });

type Item = {
	line: number;
	text: string;
};

type OpenSection = {
	line: number;
	heading: string;
	acceptedType: ChangeType | undefined;
	items: Item[];
};

type OpenRelease = {
	version: string;
	date: string | null;
	valid: boolean;
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

/**
 * @description Renders a release's sections as plain text: per section a label line such as `Added:`, then `- item` lines.
 * @param changelog The release's entry.
 * @returns The sections' blocks separated by a blank line, or `null` when the release lists no sections.
 */
export function formatChangelogText(changelog: Changelog): string | null {
	if (changelog.sections.length === 0) return null;

	return changelog.sections
		.map((section) =>
			[`${CHANGE_LABELS[section.type]}:`, ...section.items.map((item) => `- ${item}`)].join(
				'\n',
			),
		)
		.join('\n\n');
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

	let valid = true;

	if (!match) {
		valid = false;
		addIssue(
			parser,
			line,
			`Write a release heading as "## [1.2.0] - 2026-05-01", not "## ${heading}".`,
		);
	} else if (!safeParse(semverSchema, version).success) {
		valid = false;
		addIssue(parser, line, `"${version}" is not a semver version.`);
	} else if (date !== null && !safeParse(ISO_DATE, date).success) {
		valid = false;
		addIssue(parser, line, `"${date}" is not a date in YYYY-MM-DD form.`);
	}

	const previous = parser.versionLines.get(version);

	if (valid && previous !== undefined) {
		valid = false;
		addIssue(parser, line, `Version ${version} is already listed on line ${previous}.`);
	}

	if (valid) {
		parser.versionLines.set(version, line);
	}

	parser.release = { version, date, valid, sections: new Map() };
}

function closeRelease(parser: Parser) {
	closeSection(parser);

	const { release } = parser;

	parser.release = undefined;
	parser.inItem = false;

	if (!release?.valid) return;

	const sections: ChangelogSection[] = [];

	for (const type of CHANGE_TYPES) {
		const items = release.sections.get(type);

		if (items) {
			sections.push({ type, items });
		}
	}

	parser.releases.set(release.version, { date: release.date, sections });
}

function openSection(parser: Parser, heading: string, line: number) {
	const name = heading.toLowerCase();
	const parsed = safeParse(changeTypeSchema, name);
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

	parser.section = { line, heading, acceptedType: type, items: [] };
}

function closeSection(parser: Parser) {
	const { section, release } = parser;

	parser.section = undefined;

	if (!section?.acceptedType) return;

	if (section.items.length === 0) {
		addIssue(parser, section.line, `### ${section.heading} has no items.`);
	}

	const kept = release?.sections.get(section.acceptedType);

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
	CHANGE_TYPES,
	changeTypeSchema,
	changelogSectionSchema,
	changelogSchema,
	CHANGE_LABELS,
	parseChangelog,
	selectRelease,
	formatChangelogIssues,
	formatChangelogText,
};
