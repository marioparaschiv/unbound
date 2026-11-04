import { afterEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { createTempDir, runUbd, withoutProgress, type TempDir } from './helpers/ubd';
import { checkContext, reportLines } from './helpers/check';
import { namingCheck } from '../src/lib/checks/naming';
import { discoverAddons } from '../src/lib/discovery';
import { loadWorkspace } from './helpers/config';

const dirs: TempDir[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) dir.remove();
});

const PLUGINS_DIR = join(import.meta.dir, '..', '..', 'plugins');

type Manifest = Record<string, string | string[] | Record<string, string>[]>;

function manifest(folder: string, fields: Manifest = {}): string {
	return JSON.stringify({
		id: `example.${folder}`,
		name: 'Example Plugin',
		description: 'An example plugin.',
		authors: [{ name: 'example', id: '1' }],
		version: '1.0.0',
		main: 'src/index.tsx',
		...fields,
	});
}

function workspace(folder: string, files: Record<string, string>, fields?: Manifest): TempDir {
	const root = `plugins/${folder}`;
	const tree: Record<string, string> = {
		'unbound.config.json': JSON.stringify({
			addons: ['plugins/*'],
			build: 'true',
			output: 'dist',
		}),
		[`${root}/manifest.json`]: manifest(folder, fields),
		[`${root}/package.json`]: JSON.stringify({ scripts: { build: 'true' } }),
	};

	for (const [path, content] of Object.entries(files)) {
		tree[`${root}/${path}`] = content;
	}

	const dir = createTempDir(tree);

	dirs.push(dir);

	return dir;
}

const STANDARD_LAYOUT = {
	'src/index.tsx': 'export default {};',
	'src/settings.tsx': 'export default null;',
	'src/constants.ts': 'export {};',
	'src/types.ts': 'export {};',
	'src/components/toggle.tsx': 'export {};',
	'src/messages/index.ts': 'export {};',
	'src/messages/platform.ts': 'export {};',
	'src/messages/ios/hook.ts': 'export {};',
	'src/messages/android/hook.ts': 'export {};',
	'src/messages/components/badge.tsx': 'export {};',
};

describe('ubd build checks', () => {
	test('a plugin in the standard layout builds with no warnings', async () => {
		const result = await runUbd(['build'], workspace('my-plugin', STANDARD_LAYOUT).path, {});

		expect(result.exitCode).toBe(0);
		expect(withoutProgress(result.stderr)).toBe('');
	});

	test('a plugin outside the standard layout warns but still builds', async () => {
		const dir = workspace('my-plugin', {
			'src/index.ts': 'export default {};',
			'src/patches.ts': 'export {};',
			'src/ios/hook.ts': 'export {};',
			'src/messages/android/hook.ts': 'export {};',
		});
		const result = await runUbd(['build'], dir.path, {});

		expect(result.exitCode).toBe(0);
		expect(reportLines(result.stderr)).toEqual([
			'warning  plugins/my-plugin/src/index.ts  is not a standard root file.  Fix: move it into a domain folder.',
			"warning  plugins/my-plugin/src/index.tsx  is missing.  Fix: add the entry that registers the addon's features.",
			'warning  plugins/my-plugin/src/ios  holds platform code outside a domain.  Fix: move it into the domain it belongs to.',
			'warning  plugins/my-plugin/src/messages  has android/ but no platform.ts.  Fix: add platform.ts to select the platform handler.',
			'warning  plugins/my-plugin/src/patches.ts  is not a standard root file.  Fix: move it into a domain folder.',
		]);
	});

	test('a naming problem warns but still builds', async () => {
		const dir = workspace('my-plugin', STANDARD_LAYOUT, { name: 'ExamplePlugin' });
		const result = await runUbd(['build'], dir.path, {});

		expect(result.exitCode).toBe(0);
		expect(reportLines(result.stderr)).toEqual([
			'warning  plugins/my-plugin/manifest.json  name must use title-case words separated by spaces.',
		]);
	});

	test('a hand-written Capability list fails the build', async () => {
		const dir = workspace('my-plugin', STANDARD_LAYOUT, {
			capabilities: ['native.objc.invoke'],
		});
		const result = await runUbd(['build'], dir.path, {});

		expect(result.exitCode).not.toBe(0);
		expect(result.stderr).toContain(
			'error    plugins/my-plugin/manifest.json  capabilities  Declares "capabilities", which ubd build generates from the code.  Fix: remove it.',
		);
	});

	test('a bare repository skips the folder rules', async () => {
		const dir = createTempDir({
			'manifest.json': manifest('my-plugin'),
			'src/index.tsx': 'export default {};',
		});

		dirs.push(dir);

		const [addon] = await discoverAddons(loadWorkspace(dir.path));

		if (!addon) {
			throw new Error('The bare addon was not discovered.');
		}

		expect(addon.path).toBe('');
		expect(await namingCheck.run(checkContext(addon))).toEqual([]);
	});
});

describe('first-party plugins', () => {
	test('pass the naming check', async () => {
		const addons = await discoverAddons(loadWorkspace(PLUGINS_DIR));
		const issues: string[] = [];

		for (const addon of addons) {
			for (const issue of await namingCheck.run(checkContext(addon))) {
				issues.push(`${addon.id}: ${issue.message}`);
			}
		}

		expect(addons.length).toBeGreaterThan(0);
		expect(issues).toEqual([]);
	});
});
