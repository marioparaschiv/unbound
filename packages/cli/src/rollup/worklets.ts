import workletsPlugin from 'reanimated-worklets-plugin/plugin/index.js';
import { transformAsync, type PluginObj } from '@babel/core';
import typescriptPreset from '@babel/preset-typescript';
import jsxSyntax from '@babel/plugin-syntax-jsx';
import type { Plugin } from 'rollup';

import { needsWorklets } from './needs-worklets.ts';

const sourceFile = /\.(m?[jt]sx?)$/;

const initData = /^_worklet_\d+_init_data$/;

/**
 * @description Wraps each worklet's code in parentheses, as react-native-worklets' plugin does: its UI runtime evals the code as is, so a bare function declaration evals to undefined, while Reanimated 3 wraps it again harmlessly.
 * @returns The Babel plugin.
 */
function parenthesizeWorkletCode(): PluginObj {
	return {
		name: 'unbound-parenthesize-worklet-code',
		post(file) {
			file.path.traverse({
				VariableDeclarator(path) {
					const { id, init } = path.node;

					if (
						id.type !== 'Identifier' ||
						!initData.test(id.name) ||
						init?.type !== 'ObjectExpression'
					) {
						return;
					}

					for (const property of init.properties) {
						if (
							property.type === 'ObjectProperty' &&
							property.key.type === 'Identifier' &&
							property.key.name === 'code' &&
							property.value.type === 'StringLiteral' &&
							!property.value.value.startsWith('(')
						) {
							property.value.value = `(${property.value.value})`;
						}
					}
				},
			});
		},
	};
}

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
					parenthesizeWorkletCode,
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
