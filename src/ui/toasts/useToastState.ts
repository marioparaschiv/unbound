import { InternalToastOptions } from '@typings/api/toasts';
import { useSettingsStore } from '@api/storage';
import { Reanimated, ReactNative as RN } from '@metro/common';
import Toasts from '@stores/toasts';

const { useSharedValue, withTiming, withSpring } = Reanimated;

function useToastState(options: InternalToastOptions) {
	const [leaving, setLeaving] = React.useState(false);
	const settings = useSettingsStore('unbound', ({ key }) => key.startsWith('toasts'));
	const animations = settings.get('toasts.animations', true);

	const opacity = useSharedValue(0);
	const marginTop = useSharedValue(5);
	const scale = useSharedValue(0.65);
	const height = useSharedValue(0);

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
						type: 'spring',
						springDamping: 0.6
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
				height.value = withSpring(0);

				setTimeout(() => setLeaving(true), 400);
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

		const duration = (options.duration ?? settings.get('toasts.duration', 0));

		if (duration !== 0) {
			const timeout = setTimeout(leave, duration * 1000);
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
		properties: {
			marginTop,
			opacity,
			height,
			transform: [{ scale }],
		},
		leave
	};
};

export default useToastState;