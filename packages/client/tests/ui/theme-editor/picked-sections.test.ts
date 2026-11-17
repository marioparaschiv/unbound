import { describe, expect, test } from 'bun:test';

import { sectionPicked } from '~/ui/theme-editor/picked-sections';

describe('sectionPicked', () => {
	test('groups tokens by prefix in pick order and drops repeats', () => {
		const { sections, unmatched } = sectionPicked([
			{ role: 'text', color: '#111111ff', tokens: ['TEXT_MUTED', 'BACKGROUND_A'] },
			{ role: 'background', color: '#222222ff', tokens: ['BACKGROUND_B', 'TEXT_MUTED'] },
			{ role: 'border', color: '#333333ff', tokens: [] },
		]);

		expect(sections.map(({ key }) => key)).toEqual(['text', 'backgrounds']);
		expect(sections[1].tokens).toEqual([
			{ token: 'BACKGROUND_A', color: '#111111ff' },
			{ token: 'BACKGROUND_B', color: '#222222ff' },
		]);
		expect(unmatched).toEqual(['#333333ff']);
	});
});
