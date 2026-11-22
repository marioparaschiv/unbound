import { describe, expect, test } from 'bun:test';

import { findUnknownPageIcons } from '~/addon-page-icons';

describe('findUnknownPageIcons', () => {
	test('reports unknown shortcodes with their line', () => {
		const markdown =
			'## :gear: Settings\n\n- :forward: Faster.\n- :hand-pointer: Long-press.\n- :speech_balloon: Emoji.';

		expect(findUnknownPageIcons(markdown)).toEqual([
			{ name: 'forward', line: 3 },
			{ name: 'hand-pointer', line: 4 },
			{ name: 'speech_balloon', line: 5 },
		]);
	});

	test('skips code spans, fenced blocks, times and frontmatter', () => {
		const markdown = [
			'---',
			'banner: media/banner.png',
			'---',
			'At 10:30:45, `:nope:` stays.',
			'```',
			':nope:',
			'```',
			'- :sparkle: Known.',
		].join('\n');

		expect(findUnknownPageIcons(markdown)).toEqual([]);
	});
});
