import type { Settings } from '@unbound-app/settings';

/** The settings a preset sets: the bubbles' look, leaving mention colors alone. */
export type Look = Pick<
	Settings,
	| 'layout'
	| 'radius'
	| 'horizontalPadding'
	| 'verticalPadding'
	| 'spacing'
	| 'opacity'
	| 'mediaCorners'
	| 'cornerCurve'
	| 'grouping'
	| 'roundExposed'
	| 'roundOuter'
	| 'joinCurves'
	| 'smoothSteps'
	| 'groupSpacing'
	| 'roomyRows'
	| 'tail'
	| 'tailSize'
	| 'color'
	| 'ownColor'
>;

const MESSAGES: Look = {
	layout: 'dynamic',
	radius: 16,
	horizontalPadding: 14,
	verticalPadding: 10,
	spacing: 6,
	opacity: 100,
	mediaCorners: 'none',
	cornerCurve: 'continuous',
	grouping: 'grouped',
	roundExposed: true,
	roundOuter: true,
	joinCurves: true,
	smoothSteps: true,
	groupSpacing: 4,
	roomyRows: true,
	tail: false,
	tailSize: 8,
	color: '',
	ownColor: '',
};

/** The looks offered at the top of the settings, in order; `messages` is the defaults. */
export const PRESETS = {
	messages: MESSAGES,
	rounded: { ...MESSAGES, grouping: 'separate' },
	joined: { ...MESSAGES, grouping: 'joined' },
} satisfies Record<string, Look>;

export type PresetName = keyof typeof PRESETS;

/**
 * @description Finds the preset the settings match, so the picker can show it as chosen.
 * @param read Reads one setting, its default applied.
 * @returns The matching preset, or `undefined` once any of its settings differs.
 */
export function matchingPreset(read: (key: keyof Look) => unknown): PresetName | undefined {
	const same = (value: unknown, expected: unknown) =>
		typeof expected === 'string'
			? String(value ?? '').toLowerCase() === expected.toLowerCase()
			: value === expected;

	return (Object.keys(PRESETS) as PresetName[]).find((name) =>
		(Object.entries(PRESETS[name]) as [keyof Look, unknown][]).every(([key, expected]) =>
			same(read(key), expected),
		),
	);
}

export default { PRESETS, matchingPreset };
