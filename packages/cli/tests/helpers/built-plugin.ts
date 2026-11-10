import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { BuiltAddon } from '~/lib/built-addon';

/**
 * @description Makes a plugin whose build wrote `dist/index.js` from a source manifest naming `index.tsx`.
 * @param roots Receives the plugin's directory, for the test to remove.
 * @returns The built plugin.
 */
export function builtPlugin(roots: string[]): BuiltAddon {
	const dir = mkdtempSync(join(tmpdir(), 'ubd-push-'));

	roots.push(dir);

	const output = join(dir, 'dist');

	mkdirSync(output, { recursive: true });

	writeFileSync(
		join(dir, 'manifest.json'),
		JSON.stringify({
			id: 'com.example.sample',
			name: 'Sample',
			description: 'x',
			authors: [{ name: 'M', id: '1' }],
			version: '1.0.0',
			main: 'index.tsx',
		}),
	);

	writeFileSync(join(output, 'index.js'), 'module.exports = {};');

	return { id: 'com.example.sample', kind: 'plugin', dir, output, static: false };
}

/**
 * @description Writes the manifest the build emits into the plugin's output.
 * @param plugin The built plugin.
 * @param extra Fields the build adds, such as `capabilities`.
 */
export function writeBuiltManifest(plugin: BuiltAddon, extra: Record<string, string[]>) {
	writeFileSync(
		join(plugin.output, 'manifest.json'),
		JSON.stringify({ id: 'com.example.sample', main: 'index.js', ...extra }),
	);
}

export default builtPlugin;
