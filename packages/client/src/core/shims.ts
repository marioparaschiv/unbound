import { createLibraryShim } from '~/metro/library-shim';

import shimLibraries from './shim-libraries.json';

// `react` and `react-native` are resolved from the warmup globals set in `preinitialize`
const shims: Record<string, MetroExport> = {
	/**
	 * @description Resolves `react` to Discord's React from the warmup globals.
	 * @returns Discord's React module.
	 */
	get react() {
		return globalThis.React;
	},
	/**
	 * @description Resolves `react-native` to Discord's React Native from the warmup globals.
	 * @returns Discord's React Native module.
	 */
	get 'react-native'() {
		return globalThis.ReactNative;
	},
};

// Every other library in Discord's bundle is found by props the first time an import of it is read.
for (const [specifier, props] of Object.entries(shimLibraries)) {
	shims[specifier] = createLibraryShim(props);
}

/** Discord's copy of each library its bundle ships, by package name. A built plugin reads its library imports here. */
export const libraries = shims;

export default shims;
