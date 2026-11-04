import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rollup } from 'rollup';

import { unbound } from '../../src/rollup/preset';

/** The files of a throwaway plugin: its settings.ts, its en-US messages (`null` for no i18n folder) and its entry. */
export type PluginFiles = {
	settings: string;
	messages?: Record<string, string> | null;
	index?: string;
};

/** A built plugin: its bundle's code, the ids of every module in it, and the codes of rollup's warnings. */
export type BuiltPlugin = { code: string; modules: string[]; warnings: string[] };

const roots: string[] = [];

/**
 * @description Writes a throwaway plugin to a temporary folder; {@link removePlugins} deletes them.
 * @param files The plugin's files.
 * @returns The plugin's folder.
 */
export function createPlugin({
	settings,
	messages = {},
	index = 'export function start() {}',
}: PluginFiles): string {
	const root = mkdtempSync(join(tmpdir(), 'ubd-settings-'));

	roots.push(root);
	mkdirSync(join(root, 'src'));
	writeFileSync(join(root, 'manifest.json'), '{"id":"settings.test","main":"src/index.ts"}');
	writeFileSync(join(root, 'settings.ts'), settings);
	writeFileSync(join(root, 'src', 'index.ts'), index);

	if (messages) {
		mkdirSync(join(root, 'i18n'));
		writeFileSync(join(root, 'i18n', 'en-US.json'), JSON.stringify(messages));
	}

	return root;
}

/** @description Deletes every plugin {@link createPlugin} wrote. */
export function removePlugins() {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
}

/**
 * @description Builds a plugin with the `unbound` preset, without Hermes bytecode.
 * @param root The plugin's folder.
 * @returns The bundle's code, the ids of every module in it, and the codes of rollup's warnings.
 */
export async function buildPlugin(root: string): Promise<BuiltPlugin> {
	const warnings: string[] = [];
	const { output: outputOptions, ...config } = unbound(
		pathToFileURL(join(root, 'rollup.config.mjs')).href,
		{
			bytecode: false,
		},
	);
	const bundle = await rollup({
		...config,
		onwarn: (warning) => void warnings.push(warning.code ?? warning.message),
	});

	try {
		const { output } = await bundle.generate(
			Array.isArray(outputOptions) ? {} : (outputOptions ?? {}),
		);

		return { code: output[0].code, modules: output[0].moduleIds, warnings };
	} finally {
		await bundle.close();
	}
}

export default { buildPlugin, createPlugin, removePlugins };
