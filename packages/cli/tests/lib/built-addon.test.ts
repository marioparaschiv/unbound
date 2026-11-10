import type { PluginPushResult } from '@unbound-app/debugger-protocol';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { describe, expect, test, afterEach } from 'bun:test';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { listBuiltFiles, pushBuiltAddon, readBuiltAddon, type PushClient } from '~/lib/built-addon';
import { BYTECODE_DIGESTS_FILENAME } from '~/rollup/bytecode-digests-schema';

import { builtPlugin as makeBuiltPlugin, writeBuiltManifest } from '../helpers/built-plugin';
import { writeBuiltBytecode } from '../helpers/bytecode-digests';

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const builtPlugin = () => makeBuiltPlugin(roots);

const sha512 = (contents: Buffer | string) => createHash('sha512').update(contents).digest('hex');

describe('readBuiltAddon', () => {
	test('reads the manifest the build wrote into the output', () => {
		const plugin = builtPlugin();

		writeBuiltManifest(plugin, { capabilities: ['native.objc.invoke'] });

		expect(readBuiltAddon(plugin).manifest).toMatchObject({
			id: 'com.example.sample',
			main: 'index.js',
			capabilities: ['native.objc.invoke'],
		});
	});

	test('sends each image the built manifest lists, base64-encoded, by path', () => {
		const plugin = builtPlugin();
		const image = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
		const digest = createHash('sha256').update(image).digest('hex');

		mkdirSync(join(plugin.output, 'assets'));
		writeFileSync(join(plugin.output, 'assets', `${digest}.png`), image);
		writeFileSync(
			join(plugin.output, 'manifest.json'),
			JSON.stringify({
				id: 'com.example.sample',
				main: 'index.js',
				assets: { star: { type: 'png', width: 4, height: 4, scales: { 1: digest } } },
			}),
		);

		expect(readBuiltAddon(plugin).files).toEqual({
			[`assets/${digest}.png`]: image.toString('base64'),
		});
	});

	test('falls back to the source manifest when the build wrote none', () => {
		const plugin = builtPlugin();
		const { manifest, bundle } = readBuiltAddon(plugin);

		expect(manifest).toMatchObject({ id: 'com.example.sample', main: 'index.tsx' });
		expect(bundle).toBe('module.exports = {};');
	});

	test('names the built manifest when it is invalid', () => {
		const plugin = builtPlugin();

		writeFileSync(join(plugin.output, 'manifest.json'), JSON.stringify({ id: 'x' }));

		expect(() => readBuiltAddon(plugin)).toThrow(
			`Invalid ${join(plugin.output, 'manifest.json')}`,
		);
	});

	test('reads a dev manifest the publish rules would refuse, keeping every field', () => {
		const plugin = builtPlugin();
		const manifest = {
			id: 'com.example.sample',
			main: 'index.tsx',
			version: '1.0',
			authors: [{ name: 'Mario', id: 'mario' }],
		};

		writeFileSync(join(plugin.dir, 'manifest.json'), JSON.stringify(manifest));

		expect(readBuiltAddon(plugin).manifest).toMatchObject(manifest);
	});

	test('sends the bytecode built with the bundle and lists its digests in the manifest', () => {
		const plugin = builtPlugin();
		const compiled = Buffer.from([0xc6, 0x1f, 0xbc, 0x03, 0x01]);

		writeBuiltBytecode(plugin.output, 'index.js', { 98: compiled });

		const built = readBuiltAddon(plugin);

		expect(built.bytecode).toEqual({ '98': compiled.toString('base64') });
		expect(built.manifest.bytecode).toEqual({ '98': sha512(compiled) });
	});

	test('leaves out bytecode the build did not record', () => {
		const plugin = builtPlugin();

		writeFileSync(join(plugin.output, 'index.98.hbc'), 'old');

		const built = readBuiltAddon(plugin);

		expect(built.bytecode).toBeUndefined();
		expect(built.manifest.bytecode).toBeUndefined();
	});

	test('leaves out bytecode recorded for an earlier bundle', () => {
		const plugin = builtPlugin();

		writeBuiltBytecode(plugin.output, 'index.js', { 98: 'old' });
		writeFileSync(join(plugin.output, 'index.js'), 'module.exports = { rebuilt: true };');

		expect(readBuiltAddon(plugin).bytecode).toBeUndefined();
	});

	test('leaves out a bytecode file rewritten since the build recorded it', () => {
		const plugin = builtPlugin();

		writeBuiltBytecode(plugin.output, 'index.js', { 98: 'compiled', 99: 'compiled' });
		writeFileSync(join(plugin.output, 'index.99.hbc'), 'tampered');

		const built = readBuiltAddon(plugin);

		expect(Object.keys(built.bytecode ?? {})).toEqual(['98']);
		expect(Object.keys(built.manifest.bytecode ?? {})).toEqual(['98']);
	});

	test('ignores an unreadable digests file', () => {
		const plugin = builtPlugin();

		writeBuiltBytecode(plugin.output, 'index.js', { 98: 'compiled' });
		writeFileSync(join(plugin.output, BYTECODE_DIGESTS_FILENAME), '{');

		expect(readBuiltAddon(plugin).bytecode).toBeUndefined();
	});
});

describe('listBuiltFiles', () => {
	test("names this build's bytecode and the manifest's extra files without their contents", () => {
		const plugin = builtPlugin();

		writeBuiltManifest(plugin, {});
		writeBuiltBytecode(plugin.output, 'index.js', { 98: 'compiled' });

		expect(listBuiltFiles(plugin)).toMatchObject({
			bundle: 'index.js',
			bytecode: { '98': sha512('compiled') },
			files: [],
		});
	});

	test('names the expected bundle when the build wrote another', () => {
		const plugin = builtPlugin();

		rmSync(join(plugin.output, 'index.js'));

		expect(() => listBuiltFiles(plugin)).toThrow(join(plugin.output, 'index.js'));
	});
});

describe('pushBuiltAddon', () => {
	const ok: PluginPushResult = { type: 'plugin-push-result', id: 'x', ok: true };

	test('pushes the build tagged with its kind and sums it up', async () => {
		const plugin = builtPlugin();
		const pushes: Parameters<PushClient['pushPlugin']>[0][] = [];

		writeBuiltBytecode(plugin.output, 'index.js', { 98: 'compiled' });

		const pushed = await pushBuiltAddon(
			{
				async pushPlugin(push) {
					pushes.push(push);

					return ok;
				},
			},
			plugin,
		);

		expect(pushed).toEqual({ ok: true, summary: '20 bytes, bytecode 98' });
		expect(pushes[0]).toMatchObject({ addonId: 'com.example.sample', kind: 'plugin' });
	});

	test('returns a read failure instead of throwing', async () => {
		const plugin = builtPlugin();
		let pushed = false;

		const result = await pushBuiltAddon(
			{
				async pushPlugin() {
					pushed = true;

					return ok;
				},
			},
			{ ...plugin, output: join(plugin.dir, 'missing') },
		);

		expect(result.ok).toBe(false);
		expect(pushed).toBe(false);
	});
});
