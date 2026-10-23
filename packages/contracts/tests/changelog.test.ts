import { describe, expect, test } from 'bun:test';

import type { VersionChangelog } from '../src/changelog';

import {
	changelogSectionSchema,
	formatChangelogIssues,
	parseChangelog,
	selectRelease,
	versionChangelogSchema,
} from '../src/changelog';

const VALID = `# Changelog

All notable changes to this addon. Free text, *markdown* and ### headings are fine up here.

## [Unreleased]

### Whatever
anything goes in Unreleased

## [1.2.0] - 2026-05-01

### fixed
- Crash on launch
  when the cache is empty.
* Star bullets work too.

### Added

- Dark mode.

## 1.1.0

### Removed
- The old settings page.

## [1.0.0]

[1.2.0]: https://github.com/acme/addon/compare/v1.1.0...v1.2.0
[1.0.0]: https://github.com/acme/addon/releases/tag/v1.0.0
`;

type IssueCase = {
	rule: string;
	text: string;
	/** Each issue's line and a phrase its message must contain. */
	issues: [number, string][];
};

const ISSUE_CASES: IssueCase[] = [
	{
		rule: 'a non-semver version',
		text: '## [v1.0.0]\n### Added\n- x',
		issues: [[1, '"v1.0.0" is not a semver version']],
	},
	{
		rule: 'a release heading in another shape',
		text: '## Version one',
		issues: [[1, 'Write a release heading as']],
	},
	{
		rule: 'an invalid date',
		text: '## [1.0.0] - 2026-13-01\n### Added\n- x',
		issues: [[1, '"2026-13-01" is not a date']],
	},
	{
		rule: 'a duplicate version',
		text: '## 1.0.0\n### Added\n- x\n\n## [1.0.0]\n### Fixed\n- y',
		issues: [[5, 'already listed on line 1']],
	},
	{
		rule: '### Security folds into Fixed',
		text: '## 1.0.0\n### Security\n- x',
		issues: [[2, 'under ### Fixed']],
	},
	{
		rule: '### Deprecated folds into Changed',
		text: '## 1.0.0\n### Deprecated\n- x',
		issues: [[2, 'under ### Changed']],
	},
	{
		rule: 'an unknown section lists the four types',
		text: '## 1.0.0\n### Improved\n- x',
		issues: [[2, 'Use Added, Changed, Fixed or Removed']],
	},
	{
		rule: 'a section listed twice',
		text: '## 1.0.0\n### Added\n- x\n### added\n- y',
		issues: [[4, 'appears twice']],
	},
	{
		rule: 'an empty section',
		text: '## 1.0.0\n### Added\n\n### Fixed\n- y',
		issues: [[2, '### Added has no items']],
	},
	{
		rule: 'an empty section at the end of the file',
		text: '## 1.0.0\n### Fixed\n- y\n### Added\n',
		issues: [[4, '### Added has no items']],
	},
	{
		rule: 'a bullet before any section',
		text: '## 1.0.0\n- x\n### Added\n- y',
		issues: [[2, 'under a ### Added, Changed, Fixed or Removed heading']],
	},
	{
		rule: 'prose inside a release',
		text: '## 1.0.0\nSome prose.\n### Added\n- y\n#### Deeper\n# Title',
		issues: [
			[2, 'Only ### headings and - bullets'],
			[5, 'Only ### headings and - bullets'],
			[6, 'Only ### headings and - bullets'],
		],
	},
	{
		rule: 'an indented line after a blank line',
		text: '## 1.0.0\n### Added\n- x\n\n  stray',
		issues: [[5, 'must continue the bullet directly above']],
	},
	{
		rule: 'an indented line directly under a heading',
		text: '## 1.0.0\n### Added\n  stray\n- x',
		issues: [[3, 'must continue the bullet directly above']],
	},
	{
		rule: 'a nested list',
		text: '## 1.0.0\n### Added\n- x\n  - y',
		issues: [[4, 'Nested lists are not supported']],
	},
	{
		rule: 'an empty item',
		text: '## 1.0.0\n### Added\n- \n- x',
		issues: [[3, 'This item is empty']],
	},
	{
		rule: 'an item over 500 characters, counted after joining continuations',
		text: `## 1.0.0\n### Added\n- ${'a'.repeat(300)}\n  ${'b'.repeat(200)}`,
		issues: [[3, 'over 500 characters']],
	},
	{
		rule: 'more than 50 items, reported once',
		text: `## 1.0.0\n### Added\n${'- x\n'.repeat(52)}`,
		issues: [[53, 'more than 50 items']],
	},
	{
		rule: 'issues across several releases, in line order',
		text: '## 2.0.0\n### Security\n- x\n## 1.0.0\n### Added\noops',
		issues: [
			[2, 'under ### Fixed'],
			[5, '### Added has no items'],
			[6, 'Only ### headings and - bullets'],
		],
	},
];

describe('parseChangelog', () => {
	test('reads every release of a well-formed file', () => {
		const parsed = parseChangelog(VALID);

		expect(parsed.issues).toEqual([]);
		expect([...parsed.releases.keys()]).toEqual(['1.2.0', '1.1.0', '1.0.0']);

		expect(parsed.releases.get('1.2.0')).toEqual({
			date: '2026-05-01',
			sections: [
				{ type: 'added', items: ['Dark mode.'] },
				{
					type: 'fixed',
					items: ['Crash on launch when the cache is empty.', 'Star bullets work too.'],
				},
			],
		});

		expect(parsed.releases.get('1.1.0')).toEqual({
			date: null,
			sections: [{ type: 'removed', items: ['The old settings page.'] }],
		});

		expect(parsed.releases.get('1.0.0')).toEqual({ date: null, sections: [] });
	});

	test('accepts CRLF line endings and a byte order mark', () => {
		const parsed = parseChangelog('\uFEFF## 1.0.0\r\n### Added\r\n- x\r\n');

		expect(parsed.issues).toEqual([]);
		expect(parsed.releases.get('1.0.0')?.sections).toEqual([{ type: 'added', items: ['x'] }]);
	});

	test('accepts a file with only a preamble or nothing at all', () => {
		for (const text of ['', '# Changelog\n\nNothing yet.\n', '## [Unreleased]\n- wip']) {
			expect(parseChangelog(text)).toEqual({ releases: new Map(), issues: [] });
		}
	});

	for (const { rule, text, issues } of ISSUE_CASES) {
		test(`reports ${rule}`, () => {
			const parsed = parseChangelog(text);

			expect(parsed.issues.map((issue) => issue.line)).toEqual(issues.map(([line]) => line));

			for (const [index, [, phrase]] of issues.entries()) {
				expect(parsed.issues[index]?.message).toContain(phrase);
			}
		});
	}

	test('keeps well-formed releases next to broken ones and drops the broken ones', () => {
		const parsed = parseChangelog('## 2.0.0\n### Security\n- x\n## 1.0.0\n### Fixed\n- y');

		expect(parsed.releases.get('2.0.0')).toEqual({ date: null, sections: [] });
		expect(parsed.releases.get('1.0.0')?.sections).toEqual([{ type: 'fixed', items: ['y'] }]);
		expect(parseChangelog('## v2\n### Added\n- x').releases.size).toBe(0);
	});

	test('never throws', () => {
		for (const text of ['##', '###', '- x', '\n\n\n', '## [', '## 1.0.0\n###', '## 1.0.0\n-']) {
			expect(() => parseChangelog(text)).not.toThrow();
		}
	});
});

describe('selectRelease', () => {
	test('returns the entry for a listed version and undefined otherwise', () => {
		const parsed = parseChangelog(VALID);

		expect(selectRelease(parsed, '1.1.0')?.sections[0]?.type).toBe('removed');
		expect(selectRelease(parsed, '9.9.9')).toBeUndefined();
	});
});

describe('formatChangelogIssues', () => {
	test('prefixes each issue with the file and line', () => {
		const issues = [
			{ line: 2, message: 'First.' },
			{ line: 7, message: 'Second.' },
		];

		expect(formatChangelogIssues(issues)).toBe(
			'CHANGELOG.md:2: First.\nCHANGELOG.md:7: Second.',
		);
		expect(formatChangelogIssues(issues, 'plugins/a/CHANGELOG.md')).toStartWith('plugins/a/');
	});
});

describe('changelog wire schemas', () => {
	test('reads an unknown change type as changed', () => {
		expect(changelogSectionSchema.parse({ type: 'security', items: ['x'] }).type).toBe(
			'changed',
		);
	});

	test('bounds items', () => {
		expect(changelogSectionSchema.safeParse({ type: 'added', items: [] }).success).toBe(false);
		expect(changelogSectionSchema.safeParse({ type: 'added', items: [''] }).success).toBe(
			false,
		);

		const items = Array.from({ length: 51 }, () => 'x');

		expect(changelogSectionSchema.safeParse({ type: 'added', items }).success).toBe(false);
	});

	test('accepts both version changelog formats', () => {
		const sections: VersionChangelog = { format: 'sections', date: '2026-05-01', sections: [] };
		const text: VersionChangelog = { format: 'text', text: 'Fixed things.' };

		expect(versionChangelogSchema.parse(sections)).toEqual(sections);
		expect(versionChangelogSchema.parse(text)).toEqual(text);
		expect(versionChangelogSchema.safeParse({ format: 'html', text: '' }).success).toBe(false);
	});
});
