import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { dirname, join, relative } from 'node:path';

import type { DiscoveredAddon } from '../src/lib/discovery';

import { createTempDir, type TempDir } from './helpers/ubd';
import { BUILD_CHECKS } from '../src/lib/build-checks';
import { discoverAddons } from '../src/lib/discovery';
import { buildAddon } from '../src/lib/build-addon';
import { loadWorkspace } from './helpers/config';
import { checkContext } from './helpers/check';
import { scaffold } from '../src/lib/create';

type Diagnostic = { code: string; filename: string };

const CLI = join(import.meta.dir, '..');
const REPO = join(CLI, '..', '..');
const API = join(REPO, 'packages', 'api');
const ROLLUP = realpathSync(join(CLI, 'node_modules', 'rollup'));
const TYPESCRIPT = realpathSync(join(CLI, 'node_modules', 'typescript'));

const LINKED_PACKAGES = {
	'@unbound-app/cli': CLI,
	'@unbound-app/api': API,
	'@types/bun': realpathSync(join(CLI, 'node_modules', '@types', 'bun')),
	'@types/react': realpathSync(join(API, 'node_modules', '@types', 'react')),
	react: realpathSync(join(API, 'node_modules', 'react')),
	'react-native': realpathSync(join(API, 'node_modules', 'react-native')),
	rollup: ROLLUP,
	'.bin/rollup': join(ROLLUP, 'dist', 'bin', 'rollup'),
};

const GENERATED_TYPINGS = ['src/unbound-i18n.d.ts', 'src/unbound-settings.d.ts'];

const CONTRACT_STUBS: string[] = [];

let workspace: TempDir;
let addon: DiscoveredAddon;

function linkPackages(root: string) {
	for (const [name, target] of Object.entries(LINKED_PACKAGES)) {
		const link = join(root, 'node_modules', name);

		mkdirSync(dirname(link), { recursive: true });
		symlinkSync(target, link);
	}
}

function listFiles(dir: string): string[] {
	return readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => relative(dir, join(entry.parentPath, entry.name)))
		.sort();
}

async function run(command: string[], cwd: string) {
	const child = Bun.spawn(command, { cwd, stdout: 'pipe', stderr: 'pipe' });
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);

	return { exitCode, stdout, stderr };
}

async function lint(): Promise<Diagnostic[]> {
	const oxlint = join(REPO, 'node_modules', '.bin', 'oxlint');
	const { stdout } = await run([oxlint, '-A', 'all', '-f', 'json'], addon.dir);

	return JSON.parse(stdout).diagnostics;
}

beforeAll(async () => {
	workspace = createTempDir();

	scaffold(
		{
			shape: 'repository',
			kind: 'plugin',
			name: 'hello-world',
			displayName: 'Hello World',
			description: 'Greets you when it starts.',
			authorName: 'Wumpus',
			authorId: '123456789012345678',
			id: 'wumpus.hello-world',
			dir: workspace.path,
			gitInit: false,
			install: false,
		},
		void 0,
	);
	linkPackages(workspace.path);

	const [found] = await discoverAddons(loadWorkspace(workspace.path));

	if (!found) {
		throw new Error('The scaffolded plugin was not discovered.');
	}

	addon = found;
});

afterAll(() => workspace.remove());

describe('the scaffolded plugin', () => {
	test('writes the plugin layout, with the generated typings already in place', () => {
		expect(listFiles(addon.dir)).toEqual([
			'.gitignore',
			'.oxlintrc.json',
			'ADDON.md',
			'assets/icon.png',
			'bunfig.toml',
			'i18n/en-US.json',
			'manifest.json',
			'media/banner.png',
			'package.json',
			'rollup.config.mjs',
			'settings.ts',
			'src/index.tsx',
			'src/unbound-i18n.d.ts',
			'src/unbound-settings.d.ts',
			'tests/index.test.ts',
			'tsconfig.json',
		]);
		expect(readFileSync(join(addon.dir, 'rollup.config.mjs'), 'utf8')).not.toContain(
			'settingsPanel',
		);
	});

	test('typechecks against the i18n, settings and image contracts', async () => {
		const config = join(workspace.path, 'tsconfig.scaffold-check.json');
		const plugin = relative(workspace.path, addon.dir);

		writeFileSync(
			config,
			JSON.stringify({
				extends: `./${plugin}/tsconfig.json`,
				include: [
					...['src', 'tests', 'settings.ts'].map((path) => `${plugin}/${path}`),
					...CONTRACT_STUBS,
				],
			}),
		);

		const tsc = join(TYPESCRIPT, 'bin', 'tsc');
		const { exitCode, stdout } = await run(
			[process.execPath, tsc, '--noEmit', '-p', config],
			workspace.path,
		);

		rmSync(config);
		expect({ exitCode, stdout }).toEqual({ exitCode: 0, stdout: '' });
	});

	test(
		'builds and passes every build check with no warnings, leaving the typings as scaffolded',
		async () => {
			const scaffolded = GENERATED_TYPINGS.map((path) =>
				readFileSync(join(addon.dir, path), 'utf8'),
			);

			expect(await buildAddon(addon, 'bun run build')).toBe(true);

			for (const check of BUILD_CHECKS) {
				expect({ check: check.id, found: await check.run(checkContext(addon)) }).toEqual({
					check: check.id,
					found: [],
				});
			}

			const manifest = JSON.parse(readFileSync(join(addon.output, 'manifest.json'), 'utf8'));

			expect(manifest).toMatchObject({ id: 'wumpus.hello-world', main: 'index.js' });
			expect(Object.keys(manifest)).not.toContain('platforms');
			expect(existsSync(join(addon.output, 'page.json'))).toBe(true);
			expect(
				GENERATED_TYPINGS.map((path) => readFileSync(join(addon.dir, path), 'utf8')),
			).toEqual(scaffolded);
		},
		{ timeout: 120_000 },
	);

	test('passes the addon lint rules, which its lint config loads', async () => {
		expect(await lint()).toEqual([]);

		const probe = join(addon.dir, 'src', 'global.ts');

		writeFileSync(probe, 'void window.unbound;');

		const codes = (await lint()).map((diagnostic) => diagnostic.code);

		rmSync(probe);
		expect(codes).toEqual(['unbound(no-window-unbound)']);
	});

	test('passes its own tests', async () => {
		const { exitCode, stderr } = await run([process.execPath, 'test'], addon.dir);

		expect({ exitCode, stderr }).toMatchObject({ exitCode: 0 });
		expect(stderr).toContain('2 pass');
	});
});
