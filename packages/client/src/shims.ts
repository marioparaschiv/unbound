import { findByPropsLazy } from '~/api/metro/wrappers';

// `react` and `react-native` are resolved from the warmup globals set in `preinitialize`
export default {
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
	'react-native-reanimated': findByPropsLazy('useSharedValue', 'useAnimatedStyle', {
		interop: false,
	}),
	'react-native-gesture-handler': findByPropsLazy('PanGestureHandler', { interop: false }),
};
