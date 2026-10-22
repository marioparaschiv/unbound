import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import iife from 'rollup-plugin-iife';
import { hermesExpressionEntrypoint } from '@unbound-plugins/rollup-path-aliases';
import { swc } from 'rollup-plugin-swc3';

const pluginRoot = fileURLToPath(new URL('.', import.meta.url));

function resolveMentionAvatarsModule(source) {
	if (!source.startsWith('@mention-avatars/')) return null;

	const candidate = resolve(pluginRoot, 'src', source.replace(/^@mention-avatars\//, ''));
	const search = [
		candidate,
		`${candidate}.ts`,
		`${candidate}.tsx`,
		`${candidate}.js`,
		`${candidate}.mjs`,
		`${candidate}.json`,
		resolve(candidate, 'index.ts'),
		resolve(candidate, 'index.tsx'),
		resolve(candidate, 'index.js'),
	];

	for (const file of search) {
		if (existsSync(file)) return file;
	}

	return null;
}

function mentionAvatarsAlias() {
	return {
		name: 'mention-avatars-alias',
		resolveId(source) {
			return resolveMentionAvatarsModule(source);
		},
	};
}

function manifestToDist() {
	return {
		name: 'manifest-to-dist',
		buildStart() {
			const manifest = JSON.parse(readFileSync(resolve(pluginRoot, 'manifest.json'), 'utf8'));
			manifest.main = manifest.main.replace(/\.(tsx|ts|jsx|mjs)$/, '.js');
			this.emitFile({
				type: 'asset',
				fileName: 'manifest.json',
				source: `${JSON.stringify(manifest, null, '\t')}\n`,
			});
		},
	};
}

export default {
	input: 'src/index.ts',
	output: {
		dir: 'dist',
		entryFileNames: 'index.js',
		format: 'es',
		compact: true,
		exports: 'named',
		globals: { '@unbound-app/api': 'window.unbound' },
	},
	external: ['@unbound-app/api'],
	plugins: [
		mentionAvatarsAlias(),
		nodeResolve(),
		json(),
		swc({ jsc: { parser: { syntax: 'typescript' }, target: 'es2022' } }),
		iife(),
		hermesExpressionEntrypoint(),
		manifestToDist(),
	],
};
