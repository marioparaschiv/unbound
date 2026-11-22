import {
	type WithTimingConfig,
	useSharedValue,
	withSequence,
	withTiming,
	Easing,
	runOnJS,
} from 'react-native-reanimated';
import type { InternalToastOptions } from '@unbound-app/types/toasts';
import { useEffect, useRef, useState } from 'react';
import { Dimensions } from 'react-native';

import { useUnboundSettings } from '~/settings/unbound';
import toastDuration from '~/toasts/duration';
import useToastStore from '~/toasts/state';

function useToastState(options: InternalToastOptions) {
	const [closing, setClosing] = useState(options.closing);
	const [leaving, setLeaving] = useState(false);

	// Built inside the hook: `Easing` comes from the reanimated shim, so touching it at module
	// scope would resolve the metro proxy before reanimated is ready.
	const MOUNT_CHANGE_CONFIG: WithTimingConfig = {
		duration: 325,
		easing: Easing.inOut(Easing.cubic),
	};

	const settings = useUnboundSettings(({ key }) => key?.startsWith('toasts'));
	const animations = settings.get('toasts.animations');
	const duration = toastDuration(options.duration, settings.get('toasts.duration'));
	// A toast showing progress holds open; clearing its progress starts the countdown.
	const tracking = options.progress !== undefined;
	const fullWidth = Dimensions.get('window').width * 0.9;

	const opacity = useSharedValue(0);
	const marginVertical = useSharedValue(0);
	const scale = useSharedValue(0.75);
	const height = useSharedValue(0);
	const translateY = useSharedValue(0);
	const width = useSharedValue(tracking ? 0 : fullWidth);
	const tracked = useRef(tracking);

	function leave() {
		setClosing(true);

		if (animations) {
			height.value = withTiming(0, MOUNT_CHANGE_CONFIG);
			scale.value = withTiming(0.75, MOUNT_CHANGE_CONFIG);
			marginVertical.value = withTiming(0, MOUNT_CHANGE_CONFIG);
			translateY.value = withTiming(-40, MOUNT_CHANGE_CONFIG);
			opacity.value = withTiming(0, MOUNT_CHANGE_CONFIG, () => {
				runOnJS(setLeaving)(true);
			});
		} else {
			height.value = 0;
			opacity.value = 0;
			scale.value = 0.75;
			marginVertical.value = 0;
			translateY.value = -40;
			setLeaving(true);
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
	}, []);

	useEffect(() => {
		const handoff = tracked.current && animations;

		tracked.current = tracking;

		if (tracking || duration === 0) return;

		// A countdown cut short by new progress finishes unfinished and must not close the toast.
		const countdown = withTiming(0, { duration, easing: Easing.linear }, (finished) => {
			if (finished) {
				runOnJS(leave)();
			}
		});

		if (!handoff) {
			width.value = fullWidth;
			width.value = countdown;

			return;
		}

		// Finished progress fills the bar, then empties it over the close duration.
		width.value = withSequence(withTiming(fullWidth, MOUNT_CHANGE_CONFIG), countdown);
	}, [duration, tracking]);

	useEffect(() => {
		if (!tracking) return;

		const target = Math.min(1, Math.max(0, options.progress ?? 0)) * fullWidth;

		width.value = animations ? withTiming(target, MOUNT_CHANGE_CONFIG) : target;
	}, [options.progress]);

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
			transform: [{ scale }, { translateY }],
			marginVertical,
		},
		properties: { height, width },
		animations,
		duration,
		tracking,
		leave,
		closing,
	};
}

export default useToastState;
