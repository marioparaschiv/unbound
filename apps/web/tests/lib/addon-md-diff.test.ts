import { describe, expect, test } from 'bun:test';

import { diffAddonMd } from '~/lib/addon-md-diff';

describe('diffAddonMd', () => {
	test('a first listing with ADDON.md is new, and without one there is none', () => {
		expect(diffAddonMd(null, '# Hello\n')).toEqual({ state: 'new' });
		expect(diffAddonMd(null, null)).toEqual({ state: 'none' });
	});

	test('the same text is unchanged, whatever its line endings and final newline', () => {
		expect(diffAddonMd('# Hello\n\nWorld\n', '# Hello\n\nWorld\n')).toEqual({
			state: 'unchanged',
		});
		expect(diffAddonMd('# Hello\r\n\r\nWorld\r\n', '# Hello\n\nWorld')).toEqual({
			state: 'unchanged',
		});
	});

	test('an added and a removed line carry the line numbers of their side', () => {
		expect(diffAddonMd('# Hello\nold\nend\n', '# Hello\nnew\nmore\nend\n')).toEqual({
			state: 'changed',
			lines: [
				{ type: 'context', text: '# Hello', before: 1, after: 1 },
				{ type: 'removed', text: 'old', before: 2, after: null },
				{ type: 'added', text: 'new', before: null, after: 2 },
				{ type: 'added', text: 'more', before: null, after: 3 },
				{ type: 'context', text: 'end', before: 3, after: 4 },
			],
		});
	});

	test('a removed ADDON.md lists every old line as removed', () => {
		expect(diffAddonMd('# Hello\nWorld\n', null)).toEqual({
			state: 'removed',
			lines: [
				{ type: 'removed', text: '# Hello', before: 1, after: null },
				{ type: 'removed', text: 'World', before: 2, after: null },
			],
		});
	});

	test('unchanged lines far from a change collapse into counted gaps', () => {
		const lines = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`);
		const next = lines.map((line) => (line === 'line 10' ? 'line ten' : line));
		const diff = diffAddonMd(lines.join('\n'), next.join('\n'));

		if (diff.state !== 'changed') {
			throw new Error(`Expected a change, got ${diff.state}.`);
		}

		expect(
			diff.lines.map((line) => (line.type === 'skipped' ? line.count : line.text)),
		).toEqual([
			6,
			'line 7',
			'line 8',
			'line 9',
			'line 10',
			'line ten',
			'line 11',
			'line 12',
			'line 13',
			7,
		]);
	});
});
