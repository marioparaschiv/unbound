import type { InternalToastOptions } from '@typings/api/toasts';
import { type WithTimingConfig } from 'react-native-reanimated';
import { useSettingsStore } from '@api/storage';
import { Reanimated } from '@api/metro/common';
import { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';
import Toasts from '@stores/toasts';


const { useSharedValue, withTiming, Easing } = Reanimated;

const MOUNT_CHANGE_CONFIG: WithTimingConfig = { duration: 325, easing: Easing.inOut(Easing.cubic) };

function useToastState(options: InternalToastOptions) {
	const [closing, setClosing] = useState(options.closing);
	const [leaving, setLeaving] = useState(false);

	const settings = useSettingsStore('unbound', ({ key }) => key.startsWith('toasts'));
	const animations = settings.get('toasts.animations', true);

	const opacity = useSharedValue(0);
	const marginVertical = useSharedValue(0);
	const scale = useSharedValue(0.75);
	const height = useSharedValue(0);
	const translateY = useSharedValue(0);

	// This parent container set to 90% width in the styles
	const width = useSharedValue(Dimensions.get('window').width * 0.9);

	function leave() {
		setClosing(true);

		height.value = animations ? withTiming(0, MOUNT_CHANGE_CONFIG) : 0;
		opacity.value = animations ? withTiming(0, MOUNT_CHANGE_CONFIG) : 0;
		scale.value = animations ? withTiming(0.75, MOUNT_CHANGE_CONFIG) : 0.75;

		marginVertical.value = animations ? withTiming(0, MOUNT_CHANGE_CONFIG) : 0;
		translateY.value = animations ? withTiming(-40, MOUNT_CHANGE_CONFIG) : -40;

		setTimeout(() => setLeaving(true), MOUNT_CHANGE_CONFIG.duration);
	}

	useEffect(() => {
		if (animations) {
			opacity.value = withTiming(1, MOUNT_CHANGE_CONFIG);
			translateY.value = withTiming(0, MOUNT_CHANGE_CONFIG);
			scale.value = withTiming(1, MOUNT_CHANGE_CONFIG);
			marginVertical.value = withTiming(5, MOUNT_CHANGE_CONFIG);
		} else {
			opacity.value = 1;
			translateY.value = 0;
			scale.value = 1;
			marginVertical.value = 5;
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
			Toasts.setState((prev) => {
				const toasts = { ...prev.toasts };
				delete toasts[options.id];

				return { toasts };
			});
		}
	}, [leaving]);

	useEffect(() => {
		if (options.closing) {
			leave();
		}
	}, [options.closing]);

	return {
		style: {
			opacity,
			height,
			transform: [{ scale, translateY }],
			marginVertical
		},
		properties: {
			opacity,
			height,
			scale,
			translateY,
			width,
			marginVertical
		},
		leave,
		leaving,
		closing
	};
};

export default useToastState;