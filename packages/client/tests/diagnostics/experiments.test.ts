import { describe, expect, test } from 'bun:test';

import { mockLookups } from '../helpers/lookups';

mockLookups({ findStore: () => ({}) });

const { offDefaultExperiments } = await import('~/diagnostics/experiments');

const base = {
	apexDefinitions: {
		'2026-07-mobile-emoji-suggestions': { kind: 'user' },
		'2026-09-ios-anchored-chat-scroller': { kind: 'user' },
		'2026-01-guild-thing': { kind: 'guild' },
	},
	apexAssignments: {
		h1: { variantId: 2 },
		h2: { variantId: 0 },
		h3: { variantId: 1 },
	},
	hashOf: (name: string) =>
		({
			'2026-07-mobile-emoji-suggestions': 'h1',
			'2026-09-ios-anchored-chat-scroller': 'h2',
			'2026-01-guild-thing': 'h3',
		})[name] ?? 'none',
	legacyAssignments: { '2023-09_iar_user_reporting': 1, '2024-01_control': 0 },
	legacyOverrides: {},
};

describe('debug experiments', () => {
	test('lists user experiments off the default, from both systems', () => {
		expect(offDefaultExperiments(base)).toEqual([
			'2023-09_iar_user_reporting=1',
			'2026-07-mobile-emoji-suggestions=2',
		]);
	});

	test('marks overrides, even on the default variant', () => {
		const overridden = {
			...base,
			apexAssignments: { ...base.apexAssignments, h2: { variantId: 0, isOverride: true } },
			legacyOverrides: { '2024-01_control': {} },
		};

		expect(offDefaultExperiments(overridden)).toEqual([
			'2023-09_iar_user_reporting=1',
			'2024-01_control=0*',
			'2026-07-mobile-emoji-suggestions=2',
			'2026-09-ios-anchored-chat-scroller=0*',
		]);
	});
});
