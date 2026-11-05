import type { GestureEvent, PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import type { InternalToastOptions } from '@unbound-app/types/toasts';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { withSpring } from 'react-native-reanimated';
import { memo, useCallback } from 'react';
import { View } from 'react-native';

import { Discord } from '~/metro/components';
import useToastStore from '~/toasts/state';
import { icons } from '~/assets/api';

import isIconComponent from './is-icon-component';
import useToastState from './use-toast-state';
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
		animations,
		duration,
		leave,
		properties: { height, width },
	} = useToastState(options ?? { id });
	const styles = useStyles();

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

	return (
		<PanGestureHandler onGestureEvent={onGestureEvent}>
			<Animated.View
				style={[style, closing ? styles.closing : styles.open]}
				pointerEvents='box-none'
			>
				<ToastSurface onLayout={onLayout}>
					<View style={styles.wrapper}>
						{options.icon ? (
							<ToastIcon icon={options.icon} tinted={options.tintedIcon ?? true} />
						) : null}
						<ToastContent title={options.title} content={options.content} />
						<Discord.IconButton
							size='sm'
							variant='tertiary'
							icon={icons['XSmallIcon'] ?? 0}
							style={styles.closeButton}
							hitSlop={10}
							onPress={leave}
							onLongPress={dismissAll}
						/>
					</View>
					{Array.isArray(options.buttons) && options.buttons.length ? (
						<View style={styles.buttons}>
							{options.buttons.map((button, index) => (
								<Discord.Button
									key={index}
									style={styles.button}
									variant={button.variant || 'primary'}
									size={button.size || 'sm'}
									onPress={button.onPress}
									iconPosition={button.iconPosition || 'start'}
									icon={
										isIconComponent(button.icon) ? (
											<button.icon size='sm' />
										) : (
											button.icon || undefined
										)
									}
									text={button.content}
								/>
							))}
						</View>
					) : null}
					{duration > 0 ? (
						<Animated.View style={[styles.progressBar, { width }, styles.bar]} />
					) : null}
				</ToastSurface>
			</Animated.View>
		</PanGestureHandler>
	);
}

export default memo(Toast);
