// Plugins
import { typescriptPaths as paths } from 'rollup-plugin-typescript-paths';
import { nodeResolve as node } from '@rollup/plugin-node-resolve';
import { minify, swc } from 'rollup-plugin-swc3';
import hermes from '@unbound-mod/rollup-plugin';
import replace from '@rollup/plugin-replace';
import { execSync } from 'child_process';
import json from '@rollup/plugin-json';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const revision = (() => {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim();
	} catch {
		return 'N/A';
	}
})();

const preinit = readFileSync('./preinit.js');

// These must exist in
const importsMap = {
	'react': 'window.React',
	'react-native': 'window.ReactNative'
};

const generateManifest = () => ({
	name: 'generate-manifest',
	writeBundle() {
		const bundlePath = resolve('dist/unbound.bundle');
		const manifestPath = resolve('dist/manifest.json');

		let bytecodeVersion = null;

		if (existsSync(bundlePath)) {
			try {
				const fileOutput = execSync(`file "${bundlePath}"`).toString();
				const versionMatch = fileOutput.match(/version (\d+)/);
				if (versionMatch) {
					bytecodeVersion = parseInt(versionMatch[1], 10);
				}
			} catch (error) {
				console.warn('Failed to detect bytecode version:', error.message);
			}
		}

		const manifest = {
			revision,
			buildTime: new Date().toISOString(),
			bytecodeVersion,
		};

		writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
		console.log('Generated manifest.json with bytecode version:', bytecodeVersion);
	}
});

/** @type {import('rollup').RollupOptions} */
const config = {
	input: 'src/index.ts',
	external: Object.keys(importsMap),
	output: [
		{
			footer: '//# sourceURL=unbound',
			file: 'dist/unbound.js',
			format: 'iife',
			inlineDynamicImports: true,
			strict: false,
			globals: importsMap
		}
	],

	plugins: [
		paths({ preserveExtensions: true, nonRelative: !(process.platform === 'darwin' || process.platform === 'linux') }),
		node(),
		json(),
		replace({ preventAssignment: true, __VERSION__: revision }),
		swc({ tsconfig: false }),
		{
			name: 'iife',
			renderChunk(code) {
				return `(() => {
					try {
						${preinit}
						${code}
					} catch(error) {
						alert('Unbound failed to initialize: ' + error.stack);
					}
			 	})();`;
			}
		},
		minify({ compress: true, mangle: true }),
		hermes(),
		generateManifest(),
	],

	onwarn(warning, warn) {
		if (warning.code === 'EVAL') return;
		warn(warning);
	}
};

export default config;
