import { transformAsync } from '@babel/core';
import { createRequire } from 'node:module';
import Logger from '@unbound-app/logger';
import type { Plugin } from 'rolldown';

const logger = Logger.create('Build', 'Worklets');

// Matches a value/type `import … from 'react-native-reanimated'` without parsing.
const REANIMATED_IMPORT = /import[\s\S]*?from\s*['"]react-native-reanimated['"]/;

// Resolve Babel plugins to absolute paths so resolution is anchored to this
// build package rather than the process cwd, which Babel resolves relative to.
const require = createRequire(import.meta.url);
const reanimatedPlugin = require.resolve('react-native-reanimated/plugin');
const blockScopingPlugin = require.resolve('@babel/plugin-transform-block-scoping');

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

function hasWorkletTrigger(code: string): boolean {
	return WORKLET_TRIGGERS.some((trigger) => code.includes(trigger));
}

function hasReanimatedImport(code: string): boolean {
	return REANIMATED_IMPORT.test(code);
}

export default function worklets(): Plugin {
	return {
		name: 'worklets',
		transform: {
			filter: {
				id: {
					exclude: /node_modules/,
				},
				code: {
					include: /react-native-reanimated|['"]worklet['"]/,
				},
			},
			async handler(code, id) {
				const hasWorkletDirective =
					code.includes("'worklet'") || code.includes('"worklet"');

				if (!hasWorkletDirective) {
					if (!hasReanimatedImport(code) || !hasWorkletTrigger(code)) {
						return;
					}
				}

				const filename = id.split('/').pop();
				logger.log(`Transforming ${filename}`);

				const result = await transformAsync(code, {
					filename: id,
					plugins: [reanimatedPlugin, blockScopingPlugin],
					parserOpts: { plugins: ['jsx', 'typescript'] },
				});

				if (result?.code) {
					logger.log(`Transformed ${filename}`);
				} else {
					logger.warn(`No output for ${filename}`);
				}

				return result?.code ?? undefined;
			},
		},
	};
}
