import {
	existsSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';

import type { DiscoveredAddon } from '../src/lib/discovery';

import { createTempDir, type TempDir } from './helpers/ubd';
import { BUILD_CHECKS } from '../src/lib/build-checks';
import { discoverAddons } from '../src/lib/discovery';
import { buildAddon } from '../src/lib/build-addon';
import { loadWorkspace } from './helpers/config';
import { scaffold } from '../src/lib/create';

type Diagnostic = { code: string; filename: string };

const CLI = join(import.meta.dir, '..');
const REPO = join(CLI, '..', '..');
const ROLLUP = realpathSync(join(CLI, 'node_modules', 'rollup'));

const LINKED_PACKAGES = {
	'@unbound-app/cli': CLI,
	'@unbound-app/api': join(REPO, 'packages', 'api'),
	rollup: ROLLUP,
	'.bin/rollup': join(ROLLUP, 'dist', 'bin', 'rollup'),
};

let workspace: TempDir;
let addon: DiscoveredAddon;

function linkPackages(root: string) {
	for (const [name, target] of Object.entries(LINKED_PACKAGES)) {
		const link = join(root, 'node_modules', name);

		mkdirSync(dirname(link), { recursive: true });
		symlinkSync(target, link);
	}
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
	test(
		'builds and passes every build check with no warnings',
		async () => {
			expect(await buildAddon(addon, 'bun run build')).toBe(true);

			for (const check of BUILD_CHECKS) {
				expect({ check: check.name, issues: await check.run(addon) }).toEqual({
					check: check.name,
					issues: [],
				});
			}

			const manifest = JSON.parse(readFileSync(join(addon.output, 'manifest.json'), 'utf8'));

			expect(manifest).toMatchObject({ id: 'wumpus.hello-world', main: 'index.js' });
			expect(Object.keys(manifest)).not.toContain('platforms');
			expect(Object.keys(manifest)).not.toContain('platformCapabilities');
			expect(existsSync(join(addon.output, 'page.json'))).toBe(true);
		},
		{ timeout: 120_000 },
	);

	test('passes the addon lint rules, which its lint config loads', async () => {
		expect(await lint()).toEqual([]);

		writeFileSync(join(addon.dir, 'src', 'greeting', 'global.ts'), 'void window.unbound;');

		expect((await lint()).map((diagnostic) => diagnostic.code)).toEqual([
			'unbound(no-window-unbound)',
		]);
	});

	test('passes its own tests', async () => {
		const { exitCode, stderr } = await run([process.execPath, 'test'], addon.dir);

		expect({ exitCode, stderr }).toMatchObject({ exitCode: 0 });
		expect(stderr).toContain('2 pass');
	});
});
