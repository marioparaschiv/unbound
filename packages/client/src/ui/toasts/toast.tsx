import type { GestureEvent, PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import type { InternalToastOptions } from '@unbound-app/types/toasts';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { withSpring } from 'react-native-reanimated';
import { View, Image, Pressable } from 'react-native';
import { createElement, useState } from 'react';

import { BackdropFilters, Discord } from '~/api/metro/components';
import { useSettingsStore } from '~/api/storage';
import ToastStore from '~/stores/toasts';
import { Icons } from '~/api/assets';

import useToastState from './use-toast-state';
import useStyles from './toast.style';

function unitToHex(unit: number): string {
	return Math.round(unit * 255)
		.toString(16)
		.padStart(2, '0');
}

function withoutOpacity(color: string): string {
	if (color.startsWith('rgba')) {
		const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (match) {
			const [, r, g, b] = match;
			return `rgb(${r}, ${g}, ${b})`;
		}
	}
	return color.slice(0, 7);
}

function TintedIcon({ source, size = 24 }: { source: number; size?: number }) {
	const styles = useStyles();
	return <Image source={source} style={[styles.iconTint, { width: size, height: size }]} />;
}

function Toast(options: InternalToastOptions) {
	const {
		style,
		closing,
		leave,
		properties: { scale, height, width, translateY },
	} = useToastState(options);
	const settings = useSettingsStore('unbound', ({ key }) => key?.startsWith('toasts'));
	const styles = useStyles();

	const [linesLength, setLinesLength] = useState(1);

	const onGestureEvent = (event: GestureEvent<PanGestureHandlerEventPayload>) => {
		if (event.nativeEvent.translationY > -40) return;
		leave();
	};

	const resolveIcon = (icon: string | number) => {
		if (typeof icon === 'string') {
			return Icons[icon] ?? 0;
		}
		return icon;
	};

	return (
		<PanGestureHandler onGestureEvent={onGestureEvent}>
			<Animated.View
				key={options.id}
				style={[
					{ ...style, transform: [{ scale }, { translateY }] },
					{ zIndex: closing ? 0 : 10 },
				]}
				pointerEvents='box-none'
			>
				<View
					style={[
						styles.container,
						styles.toastShadow,
						{
							backgroundColor:
								withoutOpacity(styles.container.backgroundColor) +
								unitToHex(settings.get('toasts.opacity', 0.8)),
						},
					]}
					onLayout={({ nativeEvent }) => {
						if (closing || nativeEvent.layout.height === height.value) return;

						if (!settings.get('toasts.animations', true)) {
							height.value = nativeEvent.layout.height;
						} else {
							height.value = withSpring(nativeEvent.layout.height, { damping: 11 });
						}
					}}
				>
					{settings.get('toasts.opacity', 0.8) !== 1 && (
						<BackdropFilters.BackgroundBlurFill
							blurAmount={settings.get('toasts.blur', 0.15)}
						/>
					)}
					<View style={styles.wrapper}>
						{options.icon && (
							<View style={[styles.icon, { marginVertical: linesLength * 10 }]}>
								{(options.tintedIcon ?? true) ? (
									<TintedIcon
										source={resolveIcon(options.icon as string | number)}
									/>
								) : (
									<Image
										source={resolveIcon(options.icon as string | number)}
										style={{ width: 24, aspectRatio: 1 }}
									/>
								)}
							</View>
						)}
						<View style={styles.contentContainer}>
							{options.title &&
								(typeof options.title === 'function' ? (
									createElement(options.title)
								) : (
									<Discord.Text variant='text-sm/semibold'>
										{options.title as string}
									</Discord.Text>
								))}
							{options.content &&
								(typeof options.content === 'function' ? (
									createElement(options.content)
								) : (
									<Discord.Text
										style={styles.content}
										variant='text-sm/normal'
										color='text-muted'
									>
										{options.content as string}
									</Discord.Text>
								))}
						</View>
						<Pressable
							style={[
								styles.icon,
								{ marginRight: 12, marginVertical: linesLength * 10 },
							]}
							hitSlop={10}
							onPress={leave}
							onLongPress={() => {
								ToastStore.setState((prev) => {
									const toasts = { ...prev.toasts };
									for (const toast in toasts) {
										toasts[toast].closing = true;
									}
									return { toasts };
								});
							}}
						>
							<TintedIcon source={Icons['ic_close'] ?? 0} />
						</Pressable>
					</View>
					{Array.isArray(options.buttons) && options.buttons.length !== 0 && (
						<View style={[styles.buttons, { marginTop: 5 }]}>
							{options.buttons.map((button, index) => (
								<Discord.Button
									key={`${options.id}-button-${index}`}
									style={styles.button}
									variant={button.variant || 'primary'}
									size={button.size || 'sm'}
									onPress={button.onPress}
									iconPosition={button.iconPosition || 'start'}
									icon={button.icon || undefined}
									text={button.content}
								/>
							))}
						</View>
					)}
					{(options.duration ?? settings.get('toasts.duration', 3000)) > 0 && (
						<Animated.View
							style={[
								{
									position: 'absolute',
									bottom: 0,
									left: 0,
									width,
									height: 3,
									borderRadius: 100000,
								},
								styles.bar,
							]}
						/>
					)}
				</View>
			</Animated.View>
		</PanGestureHandler>
	);
}

export default Toast;
