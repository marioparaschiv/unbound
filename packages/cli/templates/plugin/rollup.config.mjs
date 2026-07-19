import { nodeResolve } from '@rollup/plugin-node-resolve';
import { swc } from 'rollup-plugin-swc3';
import json from '@rollup/plugin-json';
import iife from 'rollup-plugin-iife';

const globals = {
	'@unbound-app/api': 'window.unbound',
	'react': 'window.React',
	'react-native': 'window.ReactNative',
	'react-native-reanimated': 'window.unbound.metro.common.Reanimated',
	'@react-native-clipboard/clipboard': 'window.unbound.metro.common.Clipboard',
	'moment': 'window.unbound.metro.common.Moment',
};

/** @type {import('rollup').RollupOptions} */
export default {
	input: 'index.tsx',
	external: Object.keys(globals),
	plugins: [nodeResolve(), json(), swc({ tsconfig: false }), iife()],
	output: {
		dir: 'dist',
		format: 'es',
		compact: true,
		exports: 'named',
		globals,
	},
};
