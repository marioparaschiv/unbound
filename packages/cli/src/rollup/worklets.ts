import workletsPlugin from 'reanimated-worklets-plugin/plugin/index.js';
import typescriptPreset from '@babel/preset-typescript';
import jsxSyntax from '@babel/plugin-syntax-jsx';
import { transformAsync } from '@babel/core';
import type { Plugin } from 'rollup';

import { needsWorklets } from './needs-worklets.ts';

const sourceFile = /\.(m?[jt]sx?)$/;

/**
 * @description Compiles worklets, marked `'worklet'` or passed to an auto-workletizing call such as `useAnimatedStyle`, with the Reanimated version Discord ships, from the source before swc adds helpers the UI runtime cannot call, so plugins can run them on the UI runtime.
 * @returns The rollup plugin.
 */
export function worklets(): Plugin {
	return {
		name: 'unbound-worklets',
		async transform(code, id) {
			if (id.startsWith('\0') || !sourceFile.test(id) || !needsWorklets(code, id)) {
				return null;
			}

			const typescript = /\.m?tsx?$/.test(id);

			const result = await transformAsync(code, {
				babelrc: false,
				configFile: false,
				filename: id,
				sourceMaps: true,
				presets: typescript ? [typescriptPreset] : [],
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
