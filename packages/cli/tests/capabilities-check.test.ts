import { validateAddonCapabilities } from '@unbound-app/contracts/addon-conventions';
import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Check } from '../src/lib/check/check';

import { capabilitiesCheck, declaredCapabilitiesCheck } from '../src/lib/checks/capabilities';
import { formatDiagnostic } from '../src/rollup/diagnostic';
import { createTempDir, type TempDir } from './helpers/ubd';
import { discoverAddons } from '../src/lib/discovery';
import { loadWorkspace } from './helpers/config';
import { checkContext } from './helpers/check';

const dirs: TempDir[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) dir.remove();
});

const API_TYPES = join(import.meta.dir, '..', '..', 'api', 'src');

const NATIVE_IMPORT = "import type { PluginContext } from '@unbound-app/api/native';";

const IOS_HANDLER = `${NATIVE_IMPORT}
export function paint(context: PluginContext) {
	context.native.objc.invoke(context.native.objc.getClass('UIView'), 'layoutIfNeeded', []);
}`;

const ANDROID_HANDLER = `${NATIVE_IMPORT}
export function paint(context: PluginContext) {
	context.native.java.getClass('android.view.View');
}`;

const IOS_HOOK_HANDLER = `${NATIVE_IMPORT}
export function paint(context: PluginContext) {
	context.native.objc.hook('UIView', 'layoutIfNeeded', { after: () => undefined });
}`;

const IOS_FABRIC_BATCH_HANDLER = `${NATIVE_IMPORT}
export function paint(context: PluginContext) {
	const surface = context.native.fabric.mount(context.native.objc.getClass('UIView'), 'Card');
	context.native.fabric.batchAsync([{ surface, frame: { x: 0, y: 0, width: 40, height: 20 } }]);
}`;

const PLATFORM_FILE = `import { definePlatform } from '@unbound-app/api/native';
import { paint as ios } from './ios/paint';
import { paint as android } from './android/paint';

export const paint = definePlatform({ ios, android });`;

type Files = Record<string, string>;

type PlatformFields = { capabilities?: string[] };

type ManifestFields = {
	capabilities?: string[];
	platforms?: string[] | Record<string, PlatformFields>;
};

function plugin(files: Files, fields: ManifestFields = {}): TempDir {
	const dir = createTempDir({
		'manifest.json': JSON.stringify({ id: 'example.paint', main: 'index.ts', ...fields }),
		'package.json': JSON.stringify({ scripts: { build: 'true' } }),
		'tsconfig.json': JSON.stringify({
			compilerOptions: {
				module: 'esnext',
				moduleResolution: 'bundler',
				target: 'esnext',
				strict: true,
				paths: { '@unbound-app/api/*': [`${API_TYPES}/*`] },
			},
		}),
		...files,
	});

	dirs.push(dir);

	return dir;
}

async function check(dir: TempDir, buildCheck: Check = capabilitiesCheck) {
	const [addon] = await discoverAddons(loadWorkspace(dir.path));

	if (!addon) {
		throw new Error('The fixture plugin was not discovered.');
	}

	return (await buildCheck.run(checkContext(addon))).map((issue) => formatDiagnostic(issue));
}

function builtManifest(dir: TempDir) {
	const manifest = JSON.parse(readFileSync(join(dir.path, 'dist', 'manifest.json'), 'utf8'));

	expect(validateAddonCapabilities(manifest)).toEqual([]);

	return manifest;
}

describe('capabilities check', () => {
	test('writes each definePlatform handler’s Capabilities into the built manifest', async () => {
		const dir = plugin({
			'src/index.ts': `${NATIVE_IMPORT}
import { paint } from './platform';
export function start(context: PluginContext) { paint(context); }`,
			'src/platform.ts': PLATFORM_FILE,
			'src/ios/paint.ts': IOS_HANDLER,
			'src/android/paint.ts': ANDROID_HANDLER,
		});

		expect(await check(dir)).toEqual([]);
		expect(builtManifest(dir)).toEqual({
			id: 'example.paint',
			main: 'index.js',
			platforms: {
				ios: { capabilities: ['native.objc.classes', 'native.objc.invoke'] },
				android: { capabilities: ['native.java.classes'] },
			},
		});
	});

	test('runs a plugin with one handler on that platform only', async () => {
		const dir = plugin({
			'src/index.ts': `import { definePlatform } from '@unbound-app/api/native';
import { paint as ios } from './ios/paint';
export const start = definePlatform({ ios });`,
			'src/ios/paint.ts': IOS_HANDLER,
		});

		expect(await check(dir)).toEqual([]);
		expect(builtManifest(dir)).toMatchObject({
			platforms: { ios: { capabilities: ['native.objc.classes', 'native.objc.invoke'] } },
		});
	});

	test('declares Objective-C hooks used by the iOS handler', async () => {
		const dir = plugin({
			'src/index.ts': `import { definePlatform } from '@unbound-app/api/native';
import { paint as ios } from './ios/paint';
export const start = definePlatform({ ios });`,
			'src/ios/paint.ts': IOS_HOOK_HANDLER,
		});

		expect(await check(dir)).toEqual([]);
		expect(builtManifest(dir)).toEqual({
			id: 'example.paint',
			main: 'index.js',
			platforms: { ios: { capabilities: ['native.objc.hooks'] } },
		});
	});

	test('declares Fabric frame batches as asynchronous native work', async () => {
		const dir = plugin({
			'src/index.ts': `import { definePlatform } from '@unbound-app/api/native';
import { paint as ios } from './ios/paint';
export const start = definePlatform({ ios });`,
			'src/ios/paint.ts': IOS_FABRIC_BATCH_HANDLER,
		});

		expect(await check(dir)).toEqual([]);
		expect(builtManifest(dir)).toMatchObject({
			platforms: {
				ios: {
					capabilities: [
						'native.fabric.async',
						'native.fabric.mount',
						'native.objc.classes',
					],
				},
			},
		});
	});

	test('lists a narrowed platform even when it needs no Capabilities', async () => {
		const dir = plugin({
			'src/index.ts': `import { definePlatform } from '@unbound-app/api/native';
import { start as android } from './android/start';
export const start = definePlatform({ android });`,
			'src/android/start.ts': 'export function start() {}',
		});

		expect(await check(dir)).toEqual([]);
		expect(builtManifest(dir)).toEqual({
			id: 'example.paint',
			main: 'index.js',
			platforms: { android: {} },
		});
	});

	test('runs a plugin without definePlatform on every platform', async () => {
		const iosCode = plugin({ 'src/index.ts': IOS_HANDLER });
		const anywhere = plugin({ 'src/index.ts': 'export function start() {}' });

		expect(await check(iosCode)).toEqual([
			"src/index.ts:3:2  android cannot provide native.objc.invoke, which objc.invoke needs; select the platform's code with native.definePlatform.",
			"src/index.ts:3:29  android cannot provide native.objc.classes, which objc.getClass needs; select the platform's code with native.definePlatform.",
		]);
		expect(await check(anywhere)).toEqual([]);
		expect(builtManifest(anywhere)).toEqual({ id: 'example.paint', main: 'index.js' });
	});

	test('keeps the fields the build wrote and takes the id from the source manifest', async () => {
		const dir = plugin({
			'src/index.ts': 'export function start() {}',
			'dist/manifest.json': JSON.stringify({
				id: 'stale.id',
				main: 'bundle.js',
				version: '2.0.0',
				platforms: { ios: { capabilities: [] } },
			}),
		});

		expect(await check(dir)).toEqual([]);
		expect(builtManifest(dir)).toEqual({
			id: 'example.paint',
			main: 'bundle.js',
			version: '2.0.0',
		});
	});

	test.each(['capabilities', 'platforms'])('a hand-written %s fails the build', async (field) => {
		const dir = plugin({ 'src/index.ts': 'export function start() {}' }, { [field]: [] });

		expect(await check(dir)).toEqual([
			`manifest.json  ${field}  Declares "${field}", which ubd build generates from the code.  Fix: remove it.`,
		]);
		expect(existsSync(join(dir.path, 'dist', 'manifest.json'))).toBe(false);
	});

	test('the declared variant keeps a valid hand-written list and checks an invalid one', async () => {
		const valid = plugin(
			{ 'src/index.ts': IOS_HANDLER },
			{ platforms: { ios: { capabilities: ['native.objc.invoke'] } } },
		);
		const invalid = plugin(
			{ 'src/index.ts': IOS_HANDLER },
			{ capabilities: ['native.objc.unknown'] },
		);

		expect(await check(valid, declaredCapabilitiesCheck)).toEqual([]);
		expect(existsSync(join(valid.path, 'dist', 'manifest.json'))).toBe(false);
		expect(await check(invalid, declaredCapabilitiesCheck)).toEqual([
			'manifest.json  capabilities contains an unsupported value: native.objc.unknown.',
		]);
	});

	test('dynamic bridge access fails the build', async () => {
		const dir = plugin({
			'src/index.ts': `${NATIVE_IMPORT}
export function start(context: PluginContext, name: 'invoke' | 'getClass') {
	const objc = context.native.objc;
	void objc[name];
	void { ...objc };
}`,
		});

		expect(await check(dir)).toEqual([
			'src/index.ts:4:7  reads a bridge member by a computed name (`objc[name]`); ubd build cannot tell which native method it reaches, so call the method by name.',
			'src/index.ts:5:9  spreads a bridge (`...objc`); ubd build cannot tell which native method it reaches, so call the method by name.',
		]);
	});

	test('a call the platform cannot provide fails the build', async () => {
		const dir = plugin({
			'src/index.ts': `${NATIVE_IMPORT}
import { paint } from './platform';
export function start(context: PluginContext) {
	paint(context);
	context.native.objc.getClass('UIView');
}`,
			'src/platform.ts': PLATFORM_FILE,
			'src/ios/paint.ts': IOS_HANDLER,
			'src/android/paint.ts': ANDROID_HANDLER,
		});

		expect(await check(dir)).toEqual([
			"src/index.ts:5:2  android cannot provide native.objc.classes, which objc.getClass needs; select the platform's code with native.definePlatform.",
		]);
	});

	test('importing a Platform handler outside definePlatform fails the build', async () => {
		const dir = plugin({
			'src/index.ts': `${NATIVE_IMPORT}
import { paint } from './platform';
import { paint as paintIOS } from './ios/paint';
export function start(context: PluginContext) { paint(context); paintIOS(context); }`,
			'src/platform.ts': PLATFORM_FILE,
			'src/ios/paint.ts': IOS_HANDLER,
			'src/android/paint.ts': ANDROID_HANDLER,
		});

		expect(await check(dir)).toEqual([
			'src/index.ts:3:1  imports the ios handler src/ios/paint.ts outside native.definePlatform, so its Capabilities would reach other platforms.',
		]);
	});
});
