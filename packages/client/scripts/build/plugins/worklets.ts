import { transformAsync } from '@babel/core';
import Logger from '@unbound-app/logger';
import type { Plugin } from 'rolldown';

const logger = Logger.create('Build', 'Worklets');
const transpiler = new Bun.Transpiler({ loader: 'tsx', autoImportJSX: true });

const WORKLET_TRIGGERS = [
	// Reanimated function hooks
	'useFrameCallback',
	'useAnimatedStyle',
	'useAnimatedProps',
	'createAnimatedPropAdapter',
	'useDerivedValue',
	'useAnimatedScrollHandler',
	'useAnimatedReaction',
	'withTiming',
	'withSpring',
	'withDecay',
	'withRepeat',
	'runOnUI',
	'runOnJS',
	'executeOnUIRuntimeSync',
	'scheduleOnUI',
	'runOnUISync',
	'runOnUIAsync',
	'runOnRuntime',
	'scheduleOnRuntime',
	// Gesture handler hooks
	'useTapGesture',
	'usePanGesture',
	'usePinchGesture',
	'useRotationGesture',
	'useFlingGesture',
	'useLongPressGesture',
	'useNativeGesture',
	'useManualGesture',
	'useHoverGesture',
	// Gesture handler builder methods
	'onBegin',
	'onStart',
	'onEnd',
	'onFinalize',
	'onUpdate',
	'onChange',
	'onTouchesDown',
	'onTouchesMove',
	'onTouchesUp',
	'onTouchesCancelled',
	// Gesture objects
	'Gesture.Tap',
	'Gesture.Pan',
	'Gesture.Pinch',
	'Gesture.Rotation',
	'Gesture.Fling',
	'Gesture.LongPress',
	'Gesture.ForceTouch',
	'Gesture.Native',
	'Gesture.Manual',
	'Gesture.Race',
	'Gesture.Simultaneous',
	'Gesture.Exclusive',
	'Gesture.Hover',
	// Layout animation callback
	'withCallback',
];

function needsWorkletization(code: string): boolean {
	if (code.includes("'worklet'") || code.includes('"worklet"')) return true;

	const imports = transpiler.scanImports(code);
	if (!imports.some((i) => i.path === 'react-native-reanimated')) return false;

	return WORKLET_TRIGGERS.some((trigger) => code.includes(trigger));
}

export default function worklets(): Plugin {
	return {
		name: 'worklets',
		async transform(code, id) {
			if (id.includes('node_modules')) return;
			if (!needsWorkletization(code)) return;

			const filename = id.split('/').pop();
			logger.log(`Transforming ${filename}`);

			const result = await transformAsync(code, {
				filename: id,
				plugins: [
					'react-native-reanimated/plugin',
					'@babel/plugin-transform-block-scoping',
				],
				parserOpts: { plugins: ['jsx', 'typescript'] },
			});

			if (result?.code) {
				logger.log(`Transformed ${filename}`, result.code);
			} else {
				logger.warn(`No output for ${filename}`);
			}

			return result?.code ?? undefined;
		},
	};
}
