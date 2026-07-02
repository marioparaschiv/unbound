import { findByPropsLazy } from '~/api/metro/wrappers';

// `react` and `react-native` are resolved from the warmup globals set in `preinitialize`
export default {
	get react() {
		return globalThis.React;
	},
	get 'react-native'() {
		return globalThis.ReactNative;
	},
	'react-native-reanimated': findByPropsLazy('useSharedValue', 'useAnimatedStyle', {
		interop: false,
	}),
	'react-native-gesture-handler': findByPropsLazy(
		'Gesture',
		'GestureDetector',
		'createNativeWrapper',
		{ interop: false },
	),
};
