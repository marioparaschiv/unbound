import type { RollupOptions } from 'rollup';
import { execSync } from 'child_process';

// Plugins
import { typescriptPaths as paths } from 'rollup-plugin-typescript-paths';
import { nodeResolve as node } from '@rollup/plugin-node-resolve';
import { swc, minify } from 'rollup-plugin-swc3';
import replace from '@rollup/plugin-replace';
import json from '@rollup/plugin-json';

const revision = (() => {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim();
	} catch {
		return 'N/A';
	}
})();

const config: RollupOptions = {
	input: 'src/preload.ts',
	output: [
		{
			file: 'dist/bundle.js',
			format: 'iife',
			inlineDynamicImports: true,
			strict: false
		}
	],

	plugins: [
		paths({ preserveExtensions: true, nonRelative: process.platform === 'darwin' ? false : true }),
		node(),
		json(),
		replace({ preventAssignment: true, __VERSION__: revision }),
		swc(),
		minify({ compress: true, mangle: true })
	],

	onwarn(warning, warn) {
		if (warning.code === 'EVAL') return;
		warn(warning);
	}
};

export default config;