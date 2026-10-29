import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { afterAll, describe, expect, test } from 'bun:test';
import { glob } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { tmpdir } from 'node:os';

import type { WorkspaceConfig, WorkspaceFiles } from '../src/workspace';

import {
	findWorkspaceRoot,
	getBundleName,
	matchAddonDirs,
	readAddon,
	workspaceConfigSchema,
} from '../src/workspace';

type Tree = Record<string, string>;

const plugin = (id: string, main: string = 'src/index.ts') => JSON.stringify({ id, main });
const BUILD = JSON.stringify({ scripts: { build: 'tsdown' } });
const DEFAULTS = workspaceConfigSchema.parse({});

function filesOf(tree: Tree): WorkspaceFiles {
	return { read: (path) => tree[path] };
}

function manifestDirs(tree: Tree): string[] {
	return Object.keys(tree)
		.filter((path) => posix.basename(path) === 'manifest.json')
		.map((path) => (path.includes('/') ? posix.dirname(path) : ''));
}

function discover(tree: Tree, config: WorkspaceConfig = DEFAULTS, bare: boolean = false) {
	return matchAddonDirs(config, bare, manifestDirs(tree)).map((dir) =>
		readAddon(dir, filesOf(tree), config),
	);
}

describe('workspaceConfigSchema', () => {
	test('defaults the globs, build command and output directory', () => {
		expect(DEFAULTS).toMatchObject({
			addons: ['plugins/*', 'themes/*'],
			build: 'bun run build',
			output: 'dist',
		});
	});
});

describe('discovery over a tree', () => {
	test('a bare addon is the root itself', () => {
		const tree = {
			'manifest.json': plugin('a', 'index.js'),
			'plugins/b/manifest.json': plugin('b'),
		};

		expect(discover(tree, DEFAULTS, true)).toEqual([
			{ id: 'a', kind: 'plugin', path: '', static: true, bundle: 'index.js' },
		]);

		expect(discover({ 'README.md': '' }, DEFAULTS, true)).toEqual([]);
	});

	test('the default globs pick plugins and themes one level deep', () => {
		const tree = {
			'manifest.json': plugin('root'),
			'plugins/a/manifest.json': plugin('a'),
			'plugins/a/package.json': BUILD,
			'plugins/a/nested/manifest.json': plugin('nested'),
			'themes/t/manifest.json': plugin('t', 'theme.json'),
			'other/x/manifest.json': plugin('x'),
		};

		expect(discover(tree)).toEqual([
			{
				id: 'a',
				kind: 'plugin',
				path: 'plugins/a',
				static: false,
				bundle: 'plugins/a/dist/index.js',
			},
			{
				id: 't',
				kind: 'theme',
				path: 'themes/t',
				static: true,
				bundle: 'themes/t/theme.json',
			},
		]);
	});

	test('custom globs and output select other directories', () => {
		const config = workspaceConfigSchema.parse({
			addons: ['addons/**', 'addons/*'],
			output: './out/',
		});

		const tree = {
			'addons/a/manifest.json': plugin('a', 'src/main.tsx'),
			'addons/a/package.json': BUILD,
			'addons/group/b/manifest.json': plugin('b', 'lib/b.js'),
			'plugins/c/manifest.json': plugin('c'),
		};

		expect(discover(tree, config)).toEqual([
			{
				id: 'a',
				kind: 'plugin',
				path: 'addons/a',
				static: false,
				bundle: 'addons/a/out/main.js',
			},
			{
				id: 'b',
				kind: 'plugin',
				path: 'addons/group/b',
				static: true,
				bundle: 'addons/group/b/lib/b.js',
			},
		]);
	});

	test('a registered directory that is not an addon says why', () => {
		const tree = {
			'plugins/bad-json/manifest.json': '{ nope',
			'plugins/no-main/manifest.json': JSON.stringify({ id: 'x' }),
			'plugins/null/manifest.json': 'null',
		};

		const reasons = discover(tree).map((result) => ('reason' in result ? result.reason : ''));

		expect(reasons[0]).toContain('could not be read');
		expect(reasons[1]).toContain('no string "id" and "main"');
		expect(reasons[2]).toContain('no string "id" and "main"');
		expect(readAddon('plugins/gone', filesOf({}), DEFAULTS)).toEqual({
			path: 'plugins/gone',
			reason: 'it has no manifest.json',
		});
	});

	test('a package.json without a build script, or unreadable, leaves the addon static', () => {
		for (const pkg of [JSON.stringify({ scripts: { test: 'x' } }), '{ nope', 'null']) {
			const tree = { 'plugins/a/manifest.json': plugin('a'), 'plugins/a/package.json': pkg };

			expect(discover(tree)[0]).toMatchObject({
				static: true,
				bundle: 'plugins/a/src/index.ts',
			});
		}
	});
});

describe('getBundleName', () => {
	test('keeps a static main and maps a built main to its emitted JavaScript', () => {
		expect(getBundleName(true, 'src/index.ts')).toBe('src/index.ts');
		expect(getBundleName(false, 'src/index.ts')).toBe('index.js');
		expect(getBundleName(false, 'main.tsx')).toBe('main.js');
		expect(getBundleName(false, 'theme.json')).toBe('theme.js');
	});
});

describe('findWorkspaceRoot', () => {
	const roots = (configs: string[]) => (dir: string) => configs.includes(dir);

	test('walks up relative tree paths to the nearest config', () => {
		expect(findWorkspaceRoot('plugins/a', roots(['']))).toBe('');
		expect(findWorkspaceRoot('apps/addons/plugins/a', roots(['', 'apps/addons']))).toBe(
			'apps/addons',
		);
		expect(findWorkspaceRoot('plugins/a', roots([]))).toBeUndefined();
	});

	test('walks up absolute disk paths and stops at the filesystem root', () => {
		const seen: string[] = [];

		expect(findWorkspaceRoot('/home/me/addon', (dir) => seen.push(dir) < 0)).toBeUndefined();
		expect(seen).toEqual(['/home/me/addon', '/home/me', '/home', '/']);
		expect(findWorkspaceRoot('/home/me/addon', roots(['/home']))).toBe('/home');
		expect(findWorkspaceRoot('C:\\work\\addon', roots(['C:\\']))).toBe('C:\\');
	});
});

describe('glob compatibility with node:fs/promises glob', () => {
	const root = mkdtempSync(join(tmpdir(), 'workspace-glob-'));

	const dirs = [
		'',
		'plugins/a',
		'plugins/b',
		'plugins/.hidden',
		'plugins/a/nested',
		'themes/t',
		'packages',
		'packages/x',
		'packages/x/y',
		'addons/hello',
		'addons/jello',
		'addons/hellos',
		'other/z',
	];

	for (const dir of dirs) {
		mkdirSync(join(root, dir), { recursive: true });
		writeFileSync(join(root, dir, 'manifest.json'), '{}');
	}

	writeFileSync(join(root, 'plugins/file.txt'), '');

	afterAll(() => rmSync(root, { recursive: true, force: true }));

	async function templatePatterns(): Promise<string[]> {
		const cli = join(import.meta.dir, '../../cli');
		const patterns: string[] = [];

		for await (const path of glob('templates/**/unbound.config.json', { cwd: cli })) {
			const config = workspaceConfigSchema.parse(
				JSON.parse(readFileSync(join(cli, path), 'utf8')),
			);

			patterns.push(...config.addons);
		}

		return patterns;
	}

	test('every pattern selects the same directories', async () => {
		const fromTemplates = await templatePatterns();

		expect(fromTemplates.length).toBeGreaterThan(0);

		const patterns = [
			...new Set([
				'plugins/*',
				'themes/*',
				...fromTemplates,
				'{plugins,themes}/*',
				'**',
				'packages/**',
				'addons/?ello',
			]),
		];

		for (const pattern of patterns) {
			const expected = new Set<string>();

			for await (const match of glob(pattern, { cwd: root })) {
				if (dirs.includes(match)) {
					expected.add(match);
				}
			}

			const globstarRoot =
				pattern === '**' ? '' : pattern.endsWith('/**') ? pattern.slice(0, -3) : undefined;

			if (globstarRoot !== undefined && dirs.includes(globstarRoot)) {
				expected.add(globstarRoot);
			}

			expect(expected.size).toBeGreaterThan(0);

			const config = workspaceConfigSchema.parse({ addons: [pattern] });

			expect({ pattern, dirs: matchAddonDirs(config, false, dirs) }).toEqual({
				pattern,
				dirs: [...expected].sort(),
			});
		}
	});

	test('a globstar includes its root directory when no child segment is required', () => {
		const config = workspaceConfigSchema.parse({ addons: ['packages/**'] });

		expect(matchAddonDirs(config, false, ['packages', 'packages/client'])).toEqual([
			'packages',
			'packages/client',
		]);
	});
});
