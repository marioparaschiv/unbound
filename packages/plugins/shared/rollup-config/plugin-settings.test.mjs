import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'bun:test';

const pluginDirectory = resolve(import.meta.dir, '..', '..');
const settingsPlugins = [
	'channel-typing-indicators',
	'character-counter',
	'custom-commands',
	'message-latency',
	'more-user-tags',
	'moyai',
	'no-reply-mention',
	'pronoundb',
	'reviewdb',
	'role-color-everywhere',
	'shiki-codeblocks',
	'show-hidden-things',
	'show-me-your-name',
	'text-replace',
	'translate',
];

test('only plugins with settings register a settings panel', async () => {
	const registered = [];

	for (const plugin of readdirSync(pluginDirectory, { withFileTypes: true })) {
		if (!plugin.isDirectory()) continue;
		if (!existsSync(resolve(pluginDirectory, plugin.name, 'manifest.json'))) continue;
		const configurationPath = resolve(pluginDirectory, plugin.name, 'rollup.config.mjs');
		const configuration = (await import(pathToFileURL(configurationPath).href)).default;
		const entrypoint = configuration.plugins.find(
			(candidate) => candidate.name === 'hermes-expression-entrypoint',
		);
		const chunk = { code: '({default:{start(){},stop(){}}})', type: 'chunk' };

		expect(entrypoint).toBeDefined();
		entrypoint.generateBundle({}, { entry: chunk });
		const bundle = Function(`return ${chunk.code}`)();
		if (typeof bundle.getSettingsPanel === 'function') registered.push(plugin.name);
	}

	expect(registered.sort()).toEqual(settingsPlugins);
});
