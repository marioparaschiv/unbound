import type { GestureEvent, PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import type { InternalToastOptions } from '@unbound-app/types/toasts';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { withSpring } from 'react-native-reanimated';
import { View, Pressable } from 'react-native';
import { memo, useCallback } from 'react';

import { BackdropFilters } from '~/api/metro/components';
import { useSettingsStore } from '~/api/storage';
import useToastStore from '~/stores/toasts';
import { Icons } from '~/api/assets';

import { unitToHex, withoutOpacity } from './color';
import useToastState from './use-toast-state';
import ToastProgress from './toast-progress';
import ToastButtons from './toast-buttons';
import ToastContent from './toast-content';
import TintedIcon from './tinted-icon';
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
	} = useToastState(options ?? ({ id } as InternalToastOptions));
	const settings = useSettingsStore('unbound', ({ key }) => key?.startsWith('toasts'));
	const styles = useStyles();

	const opacity = settings.get('toasts.opacity', 0.8);
	const animations = settings.get('toasts.animations', true);

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

	const duration = options.duration ?? settings.get('toasts.duration', 3000);
	const background = withoutOpacity(styles.container.backgroundColor) + unitToHex(opacity);

	return (
		<PanGestureHandler onGestureEvent={onGestureEvent}>
			<Animated.View
				style={[
					{ ...style, transform: [{ scale }, { translateY }] },
					{ zIndex: closing ? 0 : 10 },
				]}
				pointerEvents='box-none'
			>
				<View
					style={[styles.container, styles.toastShadow, { backgroundColor: background }]}
					onLayout={onLayout}
				>
					{opacity !== 1 ? (
						<BackdropFilters.BackgroundBlurFill
							blurAmount={settings.get('toasts.blur', 0.15)}
						/>
					) : null}
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
							<TintedIcon source={Icons['ic_close'] ?? 0} />
						</Pressable>
					</View>
					{Array.isArray(options.buttons) && options.buttons.length ? (
						<ToastButtons buttons={options.buttons} />
					) : null}
					{duration > 0 ? <ToastProgress width={width} /> : null}
				</View>
			</Animated.View>
		</PanGestureHandler>
	);
}

export default memo(Toast);
