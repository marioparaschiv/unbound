import { describe, expect, test } from 'bun:test';

import coverage from '~/lib/coverage.json';
import { coverageSets } from '~/lib/coverage-sets';
import { packUrl } from '~/lib/packs';
import { FLUENT_BASE, FLUENT_MOVING_BASE, NOTO_ANIMATED_BASE, NOTO_BASE } from '~/lib/sources';

const sets = coverageSets(coverage);

describe('packUrl', () => {
	test('draws Fluent emoji animated where Microsoft animated them, else still', () => {
		expect(packUrl('fluent-animated', '\u{1F600}', sets)).toBe(
			`${FLUENT_MOVING_BASE}/1f600.webp`,
		);
		expect(packUrl('fluent-animated', '❤️', sets)).toBe(`${FLUENT_MOVING_BASE}/2764-fe0f.webp`);
		expect(packUrl('fluent-animated', '#️⃣', sets)).toBe(
			`${FLUENT_BASE}/static/23-fe0f-20e3.png`,
		);
		expect(packUrl('fluent-animated', '\u{1FAE8}', sets)).toBe(
			`${FLUENT_BASE}/static/1fae8.png`,
		);
		expect(packUrl('fluent', '\u{1F600}', sets)).toBe(`${FLUENT_BASE}/static/1f600.png`);
	});

	test('finds skin tones through folded entries', () => {
		expect(packUrl('fluent-animated', '\u{1F44D}\u{1F3FD}', sets)).toBe(
			`${FLUENT_MOVING_BASE}/1f44d-1f3fd.webp`,
		);
		expect(packUrl('fluent', '\u{1F44D}\u{1F3FD}', sets)).toBe(
			`${FLUENT_BASE}/static/1f44d-1f3fd.png`,
		);
	});

	test("keeps Discord's emoji where a pack has none", () => {
		expect(packUrl('fluent-animated', '\u{1F1E9}\u{1F1EA}', sets)).toBeUndefined();
		expect(packUrl('noto', '\u{1F1E9}\u{1F1EA}', sets)).toBeUndefined();
		expect(packUrl('fluent-animated', '\u{1FAE9}', sets)).toBeUndefined();
		expect(packUrl('fluent', '', sets)).toBeUndefined();
	});

	test('draws Noto emoji, animated where Google animated them', () => {
		expect(packUrl('noto-animated', '\u{1F600}', sets)).toBe(
			`${NOTO_ANIMATED_BASE}/1f600/512.webp`,
		);
		expect(packUrl('noto-animated', '❤️', sets)).toBe(
			`${NOTO_ANIMATED_BASE}/2764_fe0f/512.webp`,
		);
		expect(packUrl('noto', '❤️', sets)).toBe(`${NOTO_BASE}/emoji_u2764.png`);
		expect(packUrl('noto-animated', '©️', sets)).toBe(`${NOTO_ANIMATED_BASE}/a9_fe0f/512.webp`);
	});
});
