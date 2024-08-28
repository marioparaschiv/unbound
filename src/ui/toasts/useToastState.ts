import type { InternalToastOptions } from '@typings/api/toasts';
import { callbackWithAnimation } from '@utilities';
import { useSettingsStore } from '@api/storage';
import { useEffect, useState } from 'react';
import { Reanimated } from '@metro/common';
import { Dimensions } from 'react-native';
import Toasts from '@stores/toasts';

const { useSharedValue, withTiming, withSpring, Easing } = Reanimated;

function useToastState(options: InternalToastOptions) {
	const [leaving, setLeaving] = useState(false);
	const settings = useSettingsStore('unbound', ({ key }) => key.startsWith('toasts'));
	const animations = settings.get('toasts.animations', true);

	const opacity = useSharedValue(0);
	const marginTop = useSharedValue(5);
	const scale = useSharedValue(0.65);
	const height = useSharedValue(0);

	// This parent container set to 90% width in the styles
	const width = useSharedValue(Dimensions.get('window').width * 0.9);

	function leave() {
		setLeaving(true);
	}

	useEffect(() => {
		if (animations) {
			opacity.value = withTiming(1);
			marginTop.value = withTiming(0);
			scale.value = withSpring(1);
		} else {
			opacity.value = 1;
			marginTop.value = 0;
			scale.value = 1;
		}

		const duration = (options.duration ?? (settings.get('toasts.duration', 0) * 1000));

		if (duration !== 0) {
			width.value = withTiming(0, { duration: duration + 100, easing: Easing.linear });
			const timeout = setTimeout(leave, duration);
			return () => clearTimeout(timeout);
		}
	}, []);

	useEffect(() => {
		if (leaving) {
			(animations ? callbackWithAnimation(Toasts.store.setState) : Toasts.store.setState)((prev) => {
				delete prev.toasts[options.id];
				return prev;
			});
		}
	}, [leaving]);

	useEffect(() => {
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