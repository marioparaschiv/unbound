import { useSettingsStore } from '@api/storage';
import { Reanimated } from '@metro/common';
import Toasts from '@stores/toasts';
import { InternalToastOptions } from '@typings/api/toasts';

const { useSharedValue, withTiming, withSpring } = Reanimated;

export const useToastState = (options: InternalToastOptions) => {
	const [leaving, setLeaving] = React.useState(false);
	const settings = useSettingsStore('unbound', ({ key }) => key.startsWith('toasts'));

	const opacity = useSharedValue(0);
	const marginTop = useSharedValue(-30);
	const scale = useSharedValue(1.2);
	const height = useSharedValue(0);

	function leave() {
		opacity.value = withTiming(0);
		marginTop.value = withSpring(-5);
		scale.value = withSpring(0.65);
		height.value = withSpring(0);

		setTimeout(() => setLeaving(true), 300);
	}

	React.useEffect(() => {
		opacity.value = withTiming(1);
		marginTop.value = withTiming(0);
		scale.value = withSpring(1);

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
	}, [options]);

	return {
		properties: {
			marginTop,
			scale,
			opacity,
			height
		},
		leave
	};
};