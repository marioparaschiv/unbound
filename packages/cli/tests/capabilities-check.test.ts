import { NATIVE_PLUGIN_CAPABILITIES } from '@unbound-app/types/native';
import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { BuildCheck } from '../src/lib/build-checks';

import { capabilitiesCheck, declaredCapabilitiesCheck } from '../src/lib/checks/capabilities';
import { createTempDir, type TempDir } from './helpers/ubd';
import { discoverAddons } from '../src/lib/discovery';
import { loadWorkspace } from './helpers/config';

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

const PLATFORM_FILE = `import { definePlatform } from '@unbound-app/api/native';
import { paint as ios } from './ios/paint';
import { paint as android } from './android/paint';

export const paint = definePlatform({ ios, android });`;

type Files = Record<string, string>;

function plugin(files: Files, fields: Record<string, string[]> = {}): TempDir {
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

async function check(dir: TempDir, buildCheck: BuildCheck = capabilitiesCheck) {
	const [addon] = await discoverAddons(loadWorkspace(dir.path));

	if (!addon) {
		throw new Error('The fixture plugin was not discovered.');
	}

	return (await buildCheck.run(addon)).map((issue) => issue.message);
}

const KNOWN_PLATFORMS: unknown[] = ['ios', 'android'];
const KNOWN_CAPABILITIES: unknown[] = [...NATIVE_PLUGIN_CAPABILITIES];

type PlatformFields = {
	capabilities?: unknown;
	platforms?: unknown;
	platformCapabilities?: unknown;
};

function isPlainObject(value: unknown): value is PlatformFields {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// UNKNOWN: a built manifest is JSON read back from disk.
function legacyManifestErrors(manifest: unknown): string[] {
	if (!isPlainObject(manifest)) {
		return ['Manifest must be an object'];
	}

	const { capabilities, platforms, platformCapabilities } = manifest;
	const errors: string[] = [];

	if (capabilities !== void 0 && !Array.isArray(capabilities)) {
		errors.push('Manifest capabilities must be an array');
	}

	if (
		platforms !== void 0 &&
		(!Array.isArray(platforms) ||
			!platforms.length ||
			!platforms.every((platform) => KNOWN_PLATFORMS.includes(platform)))
	) {
		errors.push('Manifest platforms must be a non-empty array of known platforms');
	}

	if (platformCapabilities === void 0) {
		return errors;
	}

	if (!isPlainObject(platformCapabilities)) {
		return [...errors, 'Manifest platformCapabilities must be an object'];
	}

	for (const [platform, declared] of Object.entries(platformCapabilities)) {
		if (
			!KNOWN_PLATFORMS.includes(platform) ||
			!Array.isArray(declared) ||
			!declared.every((capability) => KNOWN_CAPABILITIES.includes(capability))
		) {
			errors.push(`Manifest platformCapabilities.${platform} is invalid`);
		}
	}

	return errors;
}

function builtManifest(dir: TempDir) {
	const manifest = JSON.parse(readFileSync(join(dir.path, 'dist', 'manifest.json'), 'utf8'));

	expect(legacyManifestErrors(manifest)).toEqual([]);

	return manifest;
}

describe('capabilities check', () => {
	test('the legacy manifest rules reject the object form of platforms', () => {
		expect(legacyManifestErrors({ platforms: { ios: { capabilities: [] } } })).toEqual([
			'Manifest platforms must be a non-empty array of known platforms',
		]);
	});

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
			platformCapabilities: {
				ios: ['native.objc.classes', 'native.objc.invoke'],
				android: ['native.java.classes'],
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
			platforms: ['ios'],
			platformCapabilities: { ios: ['native.objc.classes', 'native.objc.invoke'] },
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
			platforms: ['android'],
		});
	});

	test('runs a plugin without definePlatform on every platform', async () => {
		const iosCode = plugin({ 'src/index.ts': IOS_HANDLER });
		const anywhere = plugin({ 'src/index.ts': 'export function start() {}' });

		expect(await check(iosCode)).toEqual([
			"android cannot provide native.objc.invoke, which src/index.ts:3 needs for objc.invoke; select the platform's code with native.definePlatform.",
			"android cannot provide native.objc.classes, which src/index.ts:3 needs for objc.getClass; select the platform's code with native.definePlatform.",
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

	test.each(['capabilities', 'platforms', 'platformCapabilities'])(
		'a hand-written %s fails the build',
		async (field) => {
			const dir = plugin({ 'src/index.ts': 'export function start() {}' }, { [field]: [] });

			expect(await check(dir)).toEqual([
				`manifest.json declares "${field}"; ubd build generates platforms and Capabilities from the code, so remove it.`,
			]);
			expect(existsSync(join(dir.path, 'dist', 'manifest.json'))).toBe(false);
		},
	);

	test('the declared variant keeps a valid hand-written list and checks an invalid one', async () => {
		const valid = plugin(
			{ 'src/index.ts': IOS_HANDLER },
			{ platforms: ['ios'], capabilities: ['native.objc.invoke'] },
		);
		const invalid = plugin(
			{ 'src/index.ts': IOS_HANDLER },
			{ capabilities: ['native.objc.unknown'] },
		);

		expect(await check(valid, declaredCapabilitiesCheck)).toEqual([]);
		expect(existsSync(join(valid.path, 'dist', 'manifest.json'))).toBe(false);
		expect(await check(invalid, declaredCapabilitiesCheck)).toEqual([
			'capabilities contains an unsupported value: native.objc.unknown',
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
			'src/index.ts:4 reads a bridge member by a computed name (`objc[name]`); ubd build cannot tell which native method it reaches, so call the method by name.',
			'src/index.ts:5 spreads a bridge (`...objc`); ubd build cannot tell which native method it reaches, so call the method by name.',
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
			"android cannot provide native.objc.classes, which src/index.ts:5 needs for objc.getClass; select the platform's code with native.definePlatform.",
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
			'src/index.ts:3 imports the ios handler src/ios/paint.ts outside native.definePlatform, so its Capabilities would reach other platforms.',
		]);
	});
});
