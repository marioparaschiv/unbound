import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { describe, expect, test, afterEach } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ReloadTransport, BuiltAddon } from '~/lib/reload-transport';
import { DevServer } from '~/lib/dev-server';

import { loadWorkspace } from '../helpers/config';

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function workspace(build: string): string {
	const root = mkdtempSync(join(tmpdir(), 'ubd-dev-'));

	roots.push(root);

	writeFileSync(
		join(root, 'unbound.config.json'),
		JSON.stringify({ addons: ['plugins/*'], build, output: 'dist' }),
	);

	const pluginDir = join(root, 'plugins', 'sample');

	mkdirSync(join(pluginDir, 'dist'), { recursive: true });

	writeFileSync(
		join(pluginDir, 'manifest.json'),
		JSON.stringify({
			id: 'com.example.sample',
			name: 'Sample',
			description: 'x',
			authors: [{ name: 'M', id: '1' }],
			version: '1.0.0',
			main: 'index.tsx',
		}),
	);

	// A package.json with a build script marks the addon non-static, so the build command runs.
	writeFileSync(join(pluginDir, 'package.json'), JSON.stringify({ scripts: { build } }));
	writeFileSync(join(pluginDir, 'index.tsx'), 'export default {};');
	writeFileSync(join(pluginDir, 'dist', 'index.js'), 'module.exports = {};');

	return root;
}

function recordingTransport(): ReloadTransport & { calls: BuiltAddon[] } {
	const calls: BuiltAddon[] = [];

	return {
		calls,
		async reload(addon: BuiltAddon) {
			calls.push(addon);
		},
	};
}

describe('DevServer build-failure isolation', () => {
	test('a failing build never reaches the transport', async () => {
		const resolved = loadWorkspace(workspace('exit 1'));
		const transport = recordingTransport();
		const server = new DevServer(resolved, transport);

		await server.start();
		server.stop();

		expect(transport.calls).toEqual([]);
	});

	test('a passing build reaches the transport once per addon', async () => {
		const resolved = loadWorkspace(workspace('true'));
		const transport = recordingTransport();
		const server = new DevServer(resolved, transport);

		await server.start();
		server.stop();

		expect(transport.calls.map((addon) => addon.id)).toEqual(['com.example.sample']);
	});
});

describe('DevServer capabilities', () => {
	test('the manifest it reloads carries the generated platforms and Capabilities', async () => {
		const root = workspace('true');
		const pluginDir = join(root, 'plugins', 'sample');
		const apiTypes = join(import.meta.dir, '..', '..', '..', 'api', 'src');

		writeFileSync(
			join(pluginDir, 'tsconfig.json'),
			JSON.stringify({
				compilerOptions: {
					module: 'esnext',
					moduleResolution: 'bundler',
					target: 'esnext',
					paths: { '@unbound-app/api/*': [`${apiTypes}/*`] },
				},
			}),
		);
		writeFileSync(
			join(pluginDir, 'index.tsx'),
			`import { definePlatform } from '@unbound-app/api/native';
import { start as ios } from './ios/start';
export const start = definePlatform({ ios });`,
		);
		mkdirSync(join(pluginDir, 'ios'));
		writeFileSync(
			join(pluginDir, 'ios', 'start.ts'),
			`import type { PluginContext } from '@unbound-app/api/native';
export function start(context: PluginContext) {
	context.native.objc.getClass('UIView');
}`,
		);

		const manifests: unknown[] = [];
		const server = new DevServer(loadWorkspace(root), {
			async reload(addon) {
				manifests.push(
					JSON.parse(readFileSync(join(addon.output, 'manifest.json'), 'utf8')),
				);
			},
		});

		await server.start();
		server.stop();

		expect(manifests).toEqual([
			expect.objectContaining({
				platforms: { ios: { capabilities: ['native.objc.classes'] } },
			}),
		]);
	});
});

async function waitFor(check: () => boolean, timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		if (check()) {
			return true;
		}

		await Bun.sleep(20);
	}

	return check();
}

describe('DevServer locales', () => {
	test('rewrites the typings within a second of saving en-US.json', async () => {
		// The build command writes nothing, so the typings can only come from the watcher.
		const root = workspace('true');
		const pluginDir = join(root, 'plugins', 'sample');
		const typings = join(pluginDir, 'src', 'unbound-i18n.d.ts');

		mkdirSync(join(pluginDir, 'i18n'));
		writeFileSync(join(pluginDir, 'i18n', 'en-US.json'), JSON.stringify({ TITLE: 'Hi' }));

		const server = new DevServer(loadWorkspace(root), recordingTransport());

		await server.start();

		writeFileSync(
			join(pluginDir, 'i18n', 'en-US.json'),
			JSON.stringify({ TITLE: 'Hi', GREETING: 'Hello, {name}!' }),
		);

		const updated = await waitFor(
			() => existsSync(typings) && readFileSync(typings, 'utf8').includes('GREETING:'),
			1_000,
		);

		server.stop();

		expect(updated).toBe(true);
		expect(readFileSync(typings, 'utf8')).toContain('GREETING: { name: string | number };');
	});
});

describe('DevServer settings typings', () => {
	function pending(server: DevServer): number {
		return (Reflect.get(server, 'timers') as Map<string, unknown>).size;
	}

	test('rebuilds on a settings.ts or en-US change, but not on the typings the build writes', async () => {
		const root = workspace('true');
		const server = new DevServer(loadWorkspace(root), recordingTransport());
		const plugin = join(root, 'plugins', 'sample');
		const onChange = (path: string) =>
			Reflect.apply(Reflect.get(server, 'onChange'), server, [path]);

		await server.start();
		onChange(join(plugin, 'src', 'unbound-settings.d.ts'));
		onChange(join(plugin, 'src', 'unbound-i18n.d.ts'));
		expect(pending(server)).toBe(0);

		onChange(join(plugin, 'settings.ts'));
		expect(pending(server)).toBe(1);
		server.stop();
	});
});
