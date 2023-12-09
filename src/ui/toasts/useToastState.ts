import type { InternalToastOptions } from '@typings/api/toasts';
import { Reanimated, ReactNative as RN } from '@metro/common';
import { useSettingsStore } from '@api/storage';
import Toasts from '@stores/toasts';

const { runOnJS, useSharedValue, withTiming, withSpring, Easing } = Reanimated;

function useToastState(options: InternalToastOptions) {
	const [leaving, setLeaving] = React.useState(false);
	const settings = useSettingsStore('unbound', ({ key }) => key.startsWith('toasts'));
	const animations = settings.get('toasts.animations', true);

	const opacity = useSharedValue(0);
	const marginTop = useSharedValue(5);
	const scale = useSharedValue(0.65);
	const height = useSharedValue(0);

	// This parent container set to 90% width in the styles
	const width = useSharedValue(ReactNative.Dimensions.get('window').width * 0.9);

	function leave() {
		if (!animations) return setLeaving(true);

		RN.Platform.select({
			// Animating the Reanimated properties causes issues on iOS
			// This is because we cant use the callback in withXYZ without the app crashing
			// So, using a setTimeout instead, this causes stuttering
			// Therefore just use regular LayoutAnimation on iOS until a proper solution is found
			ios() {
				RN.LayoutAnimation.configureNext({
					duration: 1000,
					update: {
						type: 'easeInEaseOut',
						duration: 500
					},
					delete: {
						type: 'easeInEaseOut',
						property: 'opacity',
						duration: 300
					}
				});

				setLeaving(true);
			},

			default() {
				opacity.value = withTiming(0);
				marginTop.value = withSpring(-5);
				scale.value = withSpring(0.65);
				height.value = withSpring(0, {}, (finished) => finished && runOnJS(setLeaving)(true));
			}
		})();
	}

	React.useEffect(() => {
		if (animations) {
			opacity.value = withTiming(1);
			marginTop.value = withTiming(0);
			scale.value = withSpring(1);
		} else {
			opacity.value = 1;
			marginTop.value = 0;
			scale.value = 1;
		}

		const duration = (options.duration ?? settings.get('toasts.duration', 0)) * 1000;

		if (duration !== 0) {
			width.value = withTiming(0, { duration: duration + 100, easing: Easing.linear });
			const timeout = setTimeout(leave, duration);
			return () => clearTimeout(timeout);
		}
	}, []);

	React.useEffect(() => {
		if (leaving) {
			Toasts.store.setState((prev) => {
				delete prev.toasts[options.id];
				return prev;
			});
		}
	}, [leaving]);

	React.useEffect(() => {
		options.closing && leave();
	}, [options.closing]);

	return {
		style: {
			marginTop,
			opacity,
			height,
			transform: [{ scale }],
		},
		properties: {
			marginTop,
			opacity,
			height,
			scale,
			width
		},
		leave
	};
};

export default useToastState;