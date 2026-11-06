import { readAddon, workspaceConfigSchema } from '@unbound-app/contracts/workspace';
import { addonManifestSchema } from '@unbound-app/contracts/manifest';
import { parse, safeParse } from '@unbound-app/contracts/schema';
import { describe, expect, test } from 'bun:test';

import {
	ADVANCED_TOKENS,
	buildOverrideSemantic,
	getOverrideDefaults,
} from '~/lib/theme-maker/advanced-overrides';
import { buildThemeFiles, validateThemeFiles, zipThemeFiles } from '~/lib/theme-maker/theme-files';
import { DISCORD_RAWS, getSceneColors, resolveDefinition } from '~/lib/theme-maker/scene-colors';
import { DISCORD_TOKENS, getMentionSemantic } from '~/lib/theme-maker/theme-semantic';
import { SCENE_TOKENS, type SceneElement } from '~/lib/theme-maker/scene-tokens';
import { generateRaws, getRampFamily } from '~/lib/theme-maker/ramp';
import { THEME_PRESETS } from '~/lib/theme-maker/presets';
import { createZip } from '~/lib/zip';

const OCEAN = { background: '#14232b', accent: '#2fb6c9', mention: '#ffb454' };
const DRAFT = { name: 'Midnight Lagoon', authorName: 'Rosie', authorId: '581573474296791211' };
const SCENE_ELEMENTS = Object.keys(SCENE_TOKENS).filter(
	(element): element is SceneElement => element in SCENE_TOKENS,
);
// The theme maker ties the @mention pill to the mention colour, where Discord paints it with the accent.
const MENTION_PILL: SceneElement[] = ['mention', 'mentionText'];

// Reads a stored zip back by walking its local headers, as any unzip does for uncompressed entries.
function readZip(bytes: Uint8Array) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const decoder = new TextDecoder();
	const files = new Map<string, string>();
	let at = 0;

	while (view.getUint32(at, true) === 0x04034b50) {
		const size = view.getUint32(at + 18, true);
		const nameLength = view.getUint16(at + 26, true);
		const start = at + 30 + nameLength;

		files.set(
			decoder.decode(bytes.subarray(at + 30, start)),
			decoder.decode(bytes.subarray(start, start + size)),
		);
		at = start + size;
	}

	return files;
}

describe('ramp generator', () => {
	test('each anchor lands exactly on its user colour', () => {
		const raws = generateRaws(DISCORD_RAWS, OCEAN);

		expect(raws.NEUTRAL_69).toBe(OCEAN.background);
		expect(raws.BLURPLE_50).toBe(OCEAN.accent);
		expect(raws.YELLOW_300).toBe(OCEAN.mention);
	});

	test('a Discord preset regenerates the scene colours Discord ships for that theme', () => {
		for (const preset of THEME_PRESETS) {
			const themed = getSceneColors(
				generateRaws(DISCORD_RAWS, preset.colors, preset.base),
				preset.base,
				getMentionSemantic(preset.base),
			);
			const stock = getSceneColors({}, preset.base);

			for (const element of SCENE_ELEMENTS.filter((name) => !MENTION_PILL.includes(name))) {
				expect([element, themed(element)]).toEqual([element, stock(element)]);
			}
		}
	});

	test('only the three families are themed, and opacity raws keep their alpha', () => {
		const raws = generateRaws(DISCORD_RAWS, OCEAN);

		expect(Object.keys(raws).every((name) => getRampFamily(name))).toBe(true);
		expect(raws.RED_400).toBeUndefined();
		expect(raws.OPACITY_YELLOW_8?.slice(7)).toBe(DISCORD_RAWS.OPACITY_YELLOW_8?.slice(7));
	});
});

describe('scene colours', () => {
	test('a token alpha replaces the raw alpha, and an unthemed raw falls back to Discord', () => {
		expect(
			resolveDefinition('OPACITY_YELLOW_8@0.0784314', { OPACITY_YELLOW_8: '#11223344' }),
		).toBe('#11223314');
		expect(resolveDefinition('RED_400', {})).toBe(DISCORD_RAWS.RED_400 ?? '');
	});

	test('the chat background is the background colour itself', () => {
		const colors = getSceneColors(generateRaws(DISCORD_RAWS, OCEAN));

		expect(colors('chat')).toBe(OCEAN.background);
		expect(colors('primaryButton')).toBe(OCEAN.accent);
		expect(colors('mentionedGutter')).toBe(OCEAN.mention);
	});
});

describe('mention pill', () => {
	test("mirrors Discord's blurple pill on the mention ramp, step for step", () => {
		expect(getMentionSemantic('dark')).toEqual({
			MENTION_BACKGROUND: { type: 'raw', value: 'OPACITY_YELLOW_24', opacity: 0.239216 },
			MENTION_FOREGROUND: { type: 'raw', value: 'YELLOW_NEW_8' },
		});
		expect(getMentionSemantic('light').MENTION_FOREGROUND?.value).toBe('YELLOW_NEW_71');
		expect(DISCORD_TOKENS.dark.MENTION_FOREGROUND).toBe('BLURPLE_8');
	});

	test('follows the mention colour and ignores the accent', () => {
		function pill(colors: typeof OCEAN) {
			const scene = getSceneColors(
				generateRaws(DISCORD_RAWS, colors),
				'dark',
				getMentionSemantic('dark'),
			);

			return [scene('mention'), scene('mentionText')];
		}

		const raws = generateRaws(DISCORD_RAWS, OCEAN);

		expect(pill(OCEAN)).toEqual([
			`${raws.OPACITY_YELLOW_24?.slice(0, 7)}3d`,
			raws.YELLOW_NEW_8 ?? '',
		]);
		expect(pill({ ...OCEAN, accent: '#ff0000' })).toEqual(pill(OCEAN));
		expect(pill({ ...OCEAN, mention: '#00ff88' })).not.toEqual(pill(OCEAN));
	});
});

describe('semantic overrides', () => {
	test('resolve before the base definitions, with opacity replacing the alpha', () => {
		const colors = getSceneColors(generateRaws(DISCORD_RAWS, OCEAN), 'dark', {
			TEXT_DEFAULT: { type: 'color', value: '#123456' },
			TEXT_LINK: { type: 'color', value: '#123456', opacity: 0.5 },
			TEXT_MUTED: { type: 'raw', value: 'BLURPLE_50' },
		});

		expect(colors('textDefault')).toBe('#123456');
		expect(colors('link')).toBe('#12345680');
		expect(colors('textMuted')).toBe(OCEAN.accent);
	});

	test('every advanced token ships a definition for every base', () => {
		for (const preset of THEME_PRESETS) {
			for (const token of ADVANCED_TOKENS) {
				expect([preset.base, token, Boolean(DISCORD_TOKENS[preset.base][token])]).toEqual([
					preset.base,
					token,
					true,
				]);
			}
		}
	});

	test('advanced fields default to the generated colour and keep translucent tokens translucent', () => {
		const raws = generateRaws(DISCORD_RAWS, OCEAN);
		const mention = getMentionSemantic('dark');
		const semantic = buildOverrideSemantic(
			{ chat: '#101010', mentionedRow: '#ff00ff' },
			raws,
			'dark',
			mention,
		);
		const colors = getSceneColors(raws, 'dark', { ...mention, ...semantic });

		expect(getOverrideDefaults(raws, 'dark', mention).chat).toBe(OCEAN.background);
		expect(semantic).toEqual({
			CHANNEL_BACKGROUND_DEFAULT: { type: 'color', value: '#101010' },
			MOBILE_TYPING_INDICATOR_BACKGROUND_DEFAULT: { type: 'color', value: '#101010' },
			MESSAGE_MENTIONED_BACKGROUND_DEFAULT: {
				type: 'color',
				value: '#ff00ff',
				opacity: 0.0784,
			},
		});
		expect(colors('chat')).toBe('#101010');
		expect(colors('mentionedRow')).toBe('#ff00ff14');
	});
});

describe('theme download', () => {
	test('stored zips carry the right CRC', () => {
		const zip = createZip([{ path: 'a.txt', data: new TextEncoder().encode('hello') }]);

		expect(new DataView(zip.buffer).getUint32(14, true)).toBe(0x3610a686);
	});

	test('the zip is a static theme folder the submit flow reads', () => {
		const files = buildThemeFiles(DRAFT, generateRaws(DISCORD_RAWS, OCEAN));
		const entries = readZip(zipThemeFiles(files));
		const config = parse(workspaceConfigSchema, {});
		const tree = new Map([...entries].map(([path, text]) => [`themes/${path}`, text]));
		const addon = readAddon(
			'themes/midnight-lagoon',
			{ read: (path) => tree.get(path) },
			config,
		);
		const manifest: unknown = JSON.parse(entries.get('midnight-lagoon/manifest.json') ?? '');

		expect([...entries.keys()]).toEqual([
			'midnight-lagoon/manifest.json',
			'midnight-lagoon/bundle.json',
		]);
		expect(addon).toMatchObject({ id: 'rosie.midnight-lagoon', kind: 'theme', static: true });
		expect(safeParse(addonManifestSchema, manifest).success).toBe(true);
		expect(validateThemeFiles(files)).toEqual([]);
	});

	test('the bundle carries the semantic overrides', () => {
		const semantic = getMentionSemantic('dark');
		const files = buildThemeFiles(DRAFT, generateRaws(DISCORD_RAWS, OCEAN), 'dark', semantic);
		const bundle: unknown = JSON.parse(
			readZip(zipThemeFiles(files)).get('midnight-lagoon/bundle.json') ?? '',
		);

		expect(bundle).toMatchObject({ type: 'dark', semantic });
	});

	test('every preset builds a valid theme', () => {
		for (const preset of THEME_PRESETS) {
			const files = buildThemeFiles(
				{ ...DRAFT, name: preset.name },
				generateRaws(DISCORD_RAWS, preset.colors, preset.base),
				preset.base,
			);

			expect(validateThemeFiles(files)).toEqual([]);
			expect(files.bundle.type).toBe(preset.base);
		}
	});

	test('a missing Discord id or a lowercase name is reported', () => {
		const files = buildThemeFiles({ ...DRAFT, name: 'my theme', authorId: '' }, {});

		expect(validateThemeFiles(files)).toEqual([
			'name must use title-case words separated by spaces',
			'author must have a Discord user ID',
		]);
	});
});
