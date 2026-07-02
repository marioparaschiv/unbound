import {
	type WithTimingConfig,
	useSharedValue,
	withTiming,
	Easing,
	runOnJS,
} from 'react-native-reanimated';
import type { InternalToastOptions } from '@unbound-app/types/toasts';
import { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';

import { useSettingsStore } from '~/api/storage';
import useToastStore from '~/stores/toasts';

function useToastState(options: InternalToastOptions) {
	const [closing, setClosing] = useState(options.closing);
	const [leaving, setLeaving] = useState(false);

	// Built inside the hook: `Easing` comes from the reanimated shim, so touching it at module
	// scope would resolve the metro proxy before reanimated is ready.
	const MOUNT_CHANGE_CONFIG: WithTimingConfig = {
		duration: 325,
		easing: Easing.inOut(Easing.cubic),
	};

	const settings = useSettingsStore('unbound', ({ key }) => key?.startsWith('toasts'));
	const animations = settings.get('toasts.animations', true);

	const opacity = useSharedValue(0);
	const marginVertical = useSharedValue(0);
	const scale = useSharedValue(0.75);
	const height = useSharedValue(0);
	const translateY = useSharedValue(0);
	const width = useSharedValue(Dimensions.get('window').width * 0.9);

	function onLeaveComplete() {
		setLeaving(true);
	}

	function leave() {
		setClosing(true);

		if (animations) {
			height.value = withTiming(0, MOUNT_CHANGE_CONFIG);
			scale.value = withTiming(0.75, MOUNT_CHANGE_CONFIG);
			marginVertical.value = withTiming(0, MOUNT_CHANGE_CONFIG);
			translateY.value = withTiming(-40, MOUNT_CHANGE_CONFIG);
			opacity.value = withTiming(0, MOUNT_CHANGE_CONFIG, () => {
				runOnJS(onLeaveComplete)();
			});
		} else {
			height.value = 0;
			opacity.value = 0;
			scale.value = 0.75;
			marginVertical.value = 0;
			translateY.value = -40;
			onLeaveComplete();
		}
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

		const duration = options.duration ?? settings.get('toasts.duration', 0) * 1000;

		if (duration !== 0) {
			width.value = withTiming(0, { duration, easing: Easing.linear }, () => {
				runOnJS(leave)();
			});
		}
	}, []);

	useEffect(() => {
		if (leaving) {
			useToastStore.setState((prev) => {
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
			marginVertical,
		},
		properties: {
			opacity,
			height,
			scale,
			translateY,
			width,
			marginVertical,
		},
		leave,
		leaving,
		closing,
	};
}

export default useToastState;
