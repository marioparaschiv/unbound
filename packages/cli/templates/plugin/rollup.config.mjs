import { nodeResolve } from '@rollup/plugin-node-resolve';
import { swc } from 'rollup-plugin-swc3';
import json from '@rollup/plugin-json';

const globals = {
	'@unbound-app/api': 'window.unbound',
	// The bare name reaches the React Unbound passes the bundle, which keeps components' state on hot refresh.
	'react': 'React',
	'react-native': 'window.ReactNative',
	'react-native-reanimated': 'window.unbound.metro.common.Reanimated',
	'@react-native-clipboard/clipboard': 'window.unbound.metro.common.Clipboard',
	'moment': 'window.unbound.metro.common.Moment',
};

const hot = process.env.UNBOUND_HOT === '1';

function keepIifeUnnamedForUnbound(level, log, handler) {
	if (log.code !== 'MISSING_NAME_OPTION_FOR_IIFE_EXPORT') {
		handler(level, log);
	}
}

/** @type {import('rollup').RollupOptions} */
export default {
	input: 'index.tsx',
	external: Object.keys(globals),
	plugins: [
		nodeResolve(),
		json(),
		swc({
			tsconfig: false,
			jsc: { transform: { react: { refresh: hot, development: hot } } },
		}),
	],
	onLog: keepIifeUnnamedForUnbound,
	output: {
		dir: 'dist',
		format: 'iife',
		compact: true,
		exports: 'named',
		globals,
	},
};
