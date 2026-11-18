import { isSettingValue, settingEntries } from '@unbound-app/contracts/settings-schema';
import type { SettingSchema, SettingsSchema } from '@unbound-app/types/settings';
import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { evaluateSettings } from '~/rollup/settings-read';

const PLUGINS = join(import.meta.dir, '..', '..', '..', 'plugins');
const ROUNDS = 200;
const SEED = 0x5eed;

type Fuzzed = null | undefined | number | string | boolean | Fuzzed[] | { [key: string]: Fuzzed };

const CORRUPT: Fuzzed[] = [
	null,
	undefined,
	Number.NaN,
	Number.POSITIVE_INFINITY,
	Number.NEGATIVE_INFINITY,
	-1e12,
	1e12,
	0.5,
	-0,
	'',
	' ',
	'0',
	'true',
	'x'.repeat(100_000),
	'\u0000\uD800',
	true,
	false,
	{},
	[],
	[null],
	[1, 'a', {}],
	{ value: 1 },
	{ __proto__: { polluted: true } },
];

type Field = { path: string; field: SettingSchema };

function random(seed: number) {
	let state = seed;

	return () => {
		state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;

		return state / 2_147_483_648;
	};
}

function randomValue(next: () => number, depth = 0): Fuzzed {
	const pick = Math.floor(next() * (depth > 1 ? 5 : 7));

	switch (pick) {
		case 0:
			return Math.floor((next() - 0.5) * 2 ** 40);
		case 1:
			return (next() - 0.5) * 10 ** Math.floor(next() * 12);
		case 2:
			return String.fromCharCode(
				...Array.from({ length: Math.floor(next() * 40) }, () =>
					Math.floor(next() * 0xffff),
				),
			);
		case 3:
			return next() > 0.5;
		case 4:
			return null;
		case 5:
			return Array.from({ length: Math.floor(next() * 5) }, () =>
				randomValue(next, depth + 1),
			);
		default:
			return Object.fromEntries(
				Array.from({ length: Math.floor(next() * 4) }, (_, index) => [
					`k${index}`,
					randomValue(next, depth + 1),
				]),
			);
	}
}

function pluginsWithSettings(): string[] {
	return readdirSync(PLUGINS).filter((name) => existsSync(join(PLUGINS, name, 'settings.ts')));
}

async function fieldsOf(plugin: string): Promise<Field[]> {
	const { value } = await evaluateSettings(join(PLUGINS, plugin, 'settings.ts'));

	return settingEntries(value as SettingsSchema);
}

function checkSurvives(field: SettingSchema, value: Fuzzed): void {
	if (!isSettingValue(field, value)) return;

	if (typeof value === 'number') {
		expect(Number.isFinite(value)).toBe(true);
	}

	const stored = JSON.stringify(value);

	expect(JSON.stringify(JSON.parse(stored))).toBe(stored);
}

describe('every plugin settings schema under corrupt stored values', () => {
	const plugins = pluginsWithSettings();

	test('there are plugins with settings to check', () => {
		expect(plugins.length).toBeGreaterThan(0);
	});

	for (const plugin of plugins) {
		test(`${plugin} rejects or round-trips every corrupt value without throwing`, async () => {
			const next = random(SEED);

			for (const { field } of await fieldsOf(plugin)) {
				expect(isSettingValue(field, field.default)).toBe(true);

				for (const value of CORRUPT) checkSurvives(field, value);

				for (let round = 0; round < ROUNDS; round++)
					checkSurvives(field, randomValue(next));
			}
		});
	}
});
