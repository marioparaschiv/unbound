import workletsPlugin from 'reanimated-worklets-plugin/plugin/index.js';
import typescriptPreset from '@babel/preset-typescript';
import jsxSyntax from '@babel/plugin-syntax-jsx';
import { transformAsync } from '@babel/core';
import type { Plugin } from 'rollup';

const workletDirective = /(['"])worklet\1/;
const sourceFile = /\.(m?[jt]sx?)$/;

/**
 * @description Checks whether a module declares a worklet, so only those pay for the Babel pass.
 * @param code The module's source.
 * @returns Whether it contains a `'worklet'` directive.
 */
export function declaresWorklet(code: string): boolean {
	return workletDirective.test(code);
}

/**
 * @description Compiles functions marked `'worklet'` with the Reanimated version Discord ships, from the source before swc adds helpers the UI runtime cannot call, so plugins can run them on the UI runtime.
 * @returns The rollup plugin.
 */
export function worklets(): Plugin {
	return {
		name: 'unbound-worklets',
		async transform(code, id) {
			if (id.startsWith('\0') || !sourceFile.test(id) || !declaresWorklet(code)) {
				return null;
			}

			const typescript = /\.m?tsx?$/.test(id);

			const result = await transformAsync(code, {
				babelrc: false,
				configFile: false,
				filename: id,
				sourceMaps: true,
				presets: typescript
					? [[typescriptPreset, { isTSX: id.endsWith('x'), allExtensions: true }]]
					: [],
				plugins: [
					jsxSyntax,
					[workletsPlugin, { relativeSourceLocation: true, disableSourceMaps: true }],
				],
			});

			if (!result?.code) {
				return null;
			}

			return { code: result.code, map: result.map };
		},
	};
}

export default worklets;
