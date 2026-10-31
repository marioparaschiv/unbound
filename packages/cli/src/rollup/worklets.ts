import workletsPlugin from 'reanimated-worklets-plugin/plugin/index.js';
import { transformAsync } from '@babel/core';
import type { Plugin } from 'rollup';

const workletDirective = /(['"])worklet\1/;

/**
 * @description Checks whether a module declares a worklet, so only those pay for the Babel pass.
 * @param code The module's source.
 * @returns Whether it contains a `'worklet'` directive.
 */
export function declaresWorklet(code: string): boolean {
	return workletDirective.test(code);
}

/**
 * @description Compiles functions marked `'worklet'` with the Reanimated version Discord ships, so plugins can run them on the UI runtime.
 * @returns The rollup plugin.
 */
export function worklets(): Plugin {
	return {
		name: 'unbound-worklets',
		async transform(code, id) {
			if (id.startsWith('\0') || !declaresWorklet(code)) {
				return null;
			}

			const result = await transformAsync(code, {
				babelrc: false,
				configFile: false,
				filename: id,
				sourceMaps: true,
				plugins: [
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
