import type { GestureEvent, PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import type { InternalToastOptions } from '@unbound-app/types/toasts';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { withSpring } from 'react-native-reanimated';
import { View, Pressable } from 'react-native';
import { memo, useCallback } from 'react';

import { useUnboundSettings } from '~/settings/unbound';
import TintedIcon from '~/metro/fallbacks/tinted-icon';
import toastDuration from '~/toasts/duration';
import useToastStore from '~/toasts/state';
import { icons } from '~/assets/api';

import useToastState from './use-toast-state';
import ToastProgress from './toast-progress';
import ToastButtons from './toast-buttons';
import ToastContent from './toast-content';
import ToastSurface from './toast-surface';
import useStyles from './toast.style';
import ToastIcon from './toast-icon';

type ToastProps = {
	id: string;
};

type LayoutEvent = {
	nativeEvent: { layout: { height: number } };
};

/** Marks every visible toast as closing so a long-press on one dismisses them all. */
function dismissAll() {
	useToastStore.setState((prev) => {
		const toasts = { ...prev.toasts };

		for (const id in toasts) toasts[id] = { ...toasts[id], closing: true };

		return { toasts };
	});
}

function Toast({ id }: ToastProps) {
	// Subscribe to only this toast's entry so one toast updating never re-renders its siblings.
	const options = useToastStore((state) => state.toasts[id]) as InternalToastOptions | undefined;

	const {
		style,
		closing,
		leave,
		properties: { scale, height, width, translateY },
	} = useToastState(options ?? { id });
	const settings = useUnboundSettings(({ key }) => key?.startsWith('toasts'));
	const styles = useStyles();

	const animations = settings.get('toasts.animations');

	const onGestureEvent = useCallback(
		(event: GestureEvent<PanGestureHandlerEventPayload>) => {
			if (event.nativeEvent.translationY > -40) return;

			leave();
		},
		[leave],
	);

	const onLayout = useCallback(
		({ nativeEvent }: LayoutEvent) => {
			if (closing || nativeEvent.layout.height === height.value) return;

			height.value = animations
				? withSpring(nativeEvent.layout.height, { damping: 11 })
				: nativeEvent.layout.height;
		},
		[closing, animations, height],
	);

	// The store entry is gone the instant this toast is removed; skip a final empty render.
	if (!options) return null;

	const duration = toastDuration(options.duration, settings.get('toasts.duration'));

	return (
		<PanGestureHandler onGestureEvent={onGestureEvent}>
			<Animated.View
				style={[
					{ ...style, transform: [{ scale }, { translateY }] },
					{ zIndex: closing ? 0 : 10 },
				]}
				pointerEvents='box-none'
			>
				<ToastSurface onLayout={onLayout}>
					<View style={styles.wrapper}>
						{options.icon ? (
							<ToastIcon icon={options.icon} tinted={options.tintedIcon ?? true} />
						) : null}
						<ToastContent title={options.title} content={options.content} />
						<Pressable
							style={styles.closeButton}
							hitSlop={10}
							onPress={leave}
							onLongPress={dismissAll}
						>
							<TintedIcon source={icons['ic_close'] ?? 0} />
						</Pressable>
					</View>
					{Array.isArray(options.buttons) && options.buttons.length ? (
						<ToastButtons buttons={options.buttons} />
					) : null}
					{duration > 0 ? <ToastProgress width={width} /> : null}
				</ToastSurface>
			</Animated.View>
		</PanGestureHandler>
	);
}

export default memo(Toast);
