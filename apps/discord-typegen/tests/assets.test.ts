import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ASSETS_FILE, collectAssets, emitAssets, namesByType } from '~/assets';
import type { ModuleRecord } from '~/types';
import { runPipeline } from '~/pipeline';
import { loadHostProps } from '~/hosts';
import { splitModules } from '~/split';
import { TYPES_DIR } from '~/paths';

// Verbatim asset modules of discord-350's main.js: WrenchIcon (png), NitroGem1 (lottie) and an intl catalog (jsona).
const FIXTURE_IDS = [15842, 14213, 1133];
const lines = FIXTURE_IDS.flatMap((id) =>
	readFileSync(join(import.meta.dir, 'fixtures', `module-${id}.txt`), 'utf8').split('\n'),
);

async function readModules() {
	const modules: ModuleRecord[] = [];

	for await (const module of splitModules(lines)) modules.push(module);

	return modules;
}

describe('collectAssets', () => {
	test("reads each module's registered asset name and type", async () => {
		const assets = (await readModules()).flatMap(collectAssets);

		expect(assets).toEqual([
			{ name: 'WrenchIcon', type: 'png' },
			{ name: 'NitroGem1', type: 'lottie' },
			{
				name: 'bg.messages.4561bbd6f631e4227e9881e7b311a91d.compiled.messages',
				type: 'jsona',
			},
		]);
	});

	test('skips a module that registers no asset without parsing it', () => {
		const module: ModuleRecord = {
			id: 1,
			path: void 0,
			deps: [],
			source: 'r1 = {"name": "x"};',
		};

		expect(collectAssets(module)).toEqual([]);
	});
});

describe('namesByType', () => {
	test('sorts and de-duplicates names per type, leaving out hashed intl catalogs', () => {
		const names = namesByType([
			{ name: 'WrenchIcon', type: 'png' },
			{ name: 'BellIcon', type: 'png' },
			{ name: 'WrenchIcon', type: 'png' },
			{ name: 'NitroGem1', type: 'lottie' },
			{ name: 'en-US.messages.abc.compiled.messages', type: 'jsona' },
		]);

		expect([...names]).toEqual([
			['lottie', ['NitroGem1']],
			['png', ['BellIcon', 'WrenchIcon']],
		]);
	});
});

describe('emitAssets', () => {
	const text = emitAssets(
		'fixture',
		new Map([
			['lottie', ['NitroGem1']],
			['png', ['BellIcon', "it's"]],
		]),
	).replace(/\s+/g, ' ');

	test('maps each file type to the union of its names', () => {
		expect(text).toContain(
			"export type DiscordAssetNames = { lottie: | 'NitroGem1'; png: | 'BellIcon' | 'it\\'s'; };",
		);
	});

	test('derives the type and name aliases from the map', () => {
		expect(text).toContain('export type DiscordAssetType = keyof DiscordAssetNames;');
		expect(text).toContain(
			'export type DiscordAssetName<T extends DiscordAssetType = DiscordAssetType> = DiscordAssetNames[T];',
		);
	});
});

describe('runPipeline', () => {
	test('emits the asset names beside the component types', async () => {
		const { files, report } = await runPipeline(
			'fixture',
			splitModules(lines),
			loadHostProps(TYPES_DIR),
		);

		expect(files.get(ASSETS_FILE)).toContain("png:\n\t\t| 'WrenchIcon';");
		expect(report.assetNames).toEqual({ lottie: 1, png: 1 });
	});
});
