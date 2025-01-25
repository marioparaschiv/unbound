// Plugins
import { typescriptPaths as paths } from 'rollup-plugin-typescript-paths';
import { nodeResolve as node } from '@rollup/plugin-node-resolve';
import { minify, swc } from 'rollup-plugin-swc3';
import hermes from '@unbound-mod/rollup-plugin';
import replace from '@rollup/plugin-replace';
import { execSync } from 'child_process';
import json from '@rollup/plugin-json';
import { readFileSync } from 'fs';


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
	],

	onwarn(warning, warn) {
		if (warning.code === 'EVAL') return;
		warn(warning);
	}
};

export default config;