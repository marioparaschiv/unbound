import { expect, test } from 'bun:test';

import type { Changelog } from '../../contracts/src/changelog';
import type { PluginCommit } from '@scripts/plugin-changelog';
import { parseChangelog, selectRelease } from '../../contracts/src/changelog';
import { createRelease, mergeRelease, renderRelease } from '@scripts/plugin-changelog';

const DATE = '2026-05-01';

function commits(...subjects: string[]): PluginCommit[] {
	return subjects.map((subject, index) => ({ sha: `sha${index}`, subject, body: '' }));
}

function release(subjects: string[], firstRelease: boolean = false): Changelog {
	return createRelease({ commits: commits(...subjects), date: DATE, firstRelease });
}

function expectRoundTrip(text: string, version: string, changelog: Changelog) {
	const parsed = parseChangelog(text);

	expect(parsed.issues).toEqual([]);
	expect(selectRelease(parsed, version)).toEqual(changelog);
}

test('feat, fix and perf commits map to added, fixed and changed in section order', () => {
	expect(
		release(['perf: cache the lookup', 'fix: stop the crash', 'feat: add a toggle']),
	).toEqual({
		date: DATE,
		sections: [
			{ type: 'added', items: ['Add a toggle'] },
			{ type: 'changed', items: ['Cache the lookup'] },
			{ type: 'fixed', items: ['Stop the crash'] },
		],
	});
});

test('scoped and breaking headers are read like plain ones', () => {
	expect(release(['feat(moyai)!: play a louder thud', 'fix(moyai): handle reactions'])).toEqual({
		date: DATE,
		sections: [
			{ type: 'added', items: ['Play a louder thud'] },
			{ type: 'fixed', items: ['Handle reactions'] },
		],
	});
});

test('other types and non-conventional subjects are dropped', () => {
	expect(
		release([
			'chore: bump deps',
			'docs: explain the setting',
			'ci(plugins): cache bun',
			'Merge pull request #12 from someone/branch',
			'feat: keep this one',
		]).sections,
	).toEqual([{ type: 'added', items: ['Keep this one'] }]);
});

test('duplicate items are listed once, newest first', () => {
	expect(release(['feat: add b', 'feat: add a', 'feat(x): add b']).sections).toEqual([
		{ type: 'added', items: ['Add b', 'Add a'] },
	]);
});

test('sections hold at most 50 items of at most 500 characters', () => {
	const many = Array.from({ length: 60 }, (_, index) => `fix: issue ${index}`);
	const fixed = release(many).sections[0];

	expect(fixed?.items).toHaveLength(50);
	expect(fixed?.items[0]).toBe('Issue 0');

	const long = release([`feat: ${'x'.repeat(700)}`]);
	const item = long.sections[0]?.items[0] ?? '';

	expect(item.length).toBe(500);
	expectRoundTrip(renderRelease('1.0.0', long), '1.0.0', long);
});

test('a release with no qualifying commits gets a maintenance item', () => {
	expect(release(['chore: tidy'])).toEqual({
		date: DATE,
		sections: [
			{ type: 'changed', items: ['Maintenance release with no user-facing changes.'] },
		],
	});
});

test('a first release with no qualifying commits is an initial release', () => {
	expect(release([], true)).toEqual({
		date: DATE,
		sections: [{ type: 'added', items: ['Initial release.'] }],
	});
});

test('a rendered release round-trips through parseChangelog', () => {
	const changelog = release(['feat: add a toggle', 'fix: stop the crash', 'perf: faster']);
	const text = renderRelease('1.2.0', changelog);

	expect(text).toBe(
		'## [1.2.0] - 2026-05-01\n\n### Added\n\n- Add a toggle\n\n### Changed\n\n- Faster\n\n### Fixed\n\n- Stop the crash\n',
	);
	expectRoundTrip(text, '1.2.0', changelog);
});

test('merging without a file creates one', () => {
	const changelog = release(['feat: add a toggle']);
	const text = mergeRelease(undefined, '1.0.0', changelog);

	expect(text.startsWith('# Changelog\n\n## [1.0.0] - 2026-05-01\n')).toBe(true);
	expectRoundTrip(text, '1.0.0', changelog);
});

test('merging inserts the release above the newest one and keeps the rest', () => {
	const existing =
		'# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n\n### Added\n\n- Initial release.\n';
	const changelog = release(['fix: stop the crash']);
	const text = mergeRelease(existing, '1.1.0', changelog);
	const parsed = parseChangelog(text);

	expectRoundTrip(text, '1.1.0', changelog);
	expect(selectRelease(parsed, '1.0.0')).toEqual({
		date: '2026-01-01',
		sections: [{ type: 'added', items: ['Initial release.'] }],
	});
	expect(text.indexOf('## [1.1.0]')).toBeGreaterThan(text.indexOf('## [Unreleased]'));
	expect(text.indexOf('## [1.1.0]')).toBeLessThan(text.indexOf('## [1.0.0]'));
});

test('merging into a file without releases appends the release', () => {
	const changelog = release(['feat: add a toggle']);
	const text = mergeRelease('# Changelog\n\nAll notable changes.\n', '1.0.0', changelog);

	expect(text.startsWith('# Changelog\n\nAll notable changes.\n\n## [1.0.0]')).toBe(true);
	expectRoundTrip(text, '1.0.0', changelog);
});

test('a hand-written entry for the version wins', () => {
	const existing = '# Changelog\n\n## [1.1.0] - 2026-04-01\n\n### Fixed\n\n- Written by hand.\n';

	expect(mergeRelease(existing, '1.1.0', release(['feat: generated']))).toBe(existing);
});
