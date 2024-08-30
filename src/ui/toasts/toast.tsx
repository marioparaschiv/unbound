import type { GestureEvent, PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import type { InternalToastOptions } from '@typings/api/toasts';
import { BackdropFilters, Design } from '@api/metro/components';
import { View, Image, Text, Pressable } from 'react-native';
import { Reanimated, Gestures } from '@api/metro/common';
import { unitToHex, withoutOpacity } from '@utilities';
import { createElement, useState } from 'react';
import { useSettingsStore } from '@api/storage';
import { TintedIcon } from '@ui/misc/forms';
import { Icons } from '@api/assets';
import Toasts from '@stores/toasts';

import useToastState from './useToastState';
import useStyles from './toast.style';

const { withSpring, default: Animated } = Reanimated;
const { PanGestureHandler } = Gestures;

function Toast(options: InternalToastOptions) {
	const { style, closing, leave, properties: { scale, height, width, translateY } } = useToastState(options);
	const settings = useSettingsStore('unbound', ({ key }) => key.startsWith('toasts'));
	const styles = useStyles();

	// Default for if there is no content at all
	const [linesLength, setLinesLength] = useState(1);

	const onGestureEvent = (event: GestureEvent<PanGestureHandlerEventPayload>) => {
		if (event.nativeEvent.translationY > -40) return;

		leave();
	};

	return <PanGestureHandler onGestureEvent={onGestureEvent}>
		<Animated.View key={options.id} style={[{ ...style, transform: [{ scale }, { translateY }] }, { zIndex: closing ? 0 : 10 }]} pointerEvents='box-none'>
			<View
				style={[styles.container, styles.toastShadow, { backgroundColor: withoutOpacity(styles.container.backgroundColor) + unitToHex(settings.get('toasts.opacity', 0.8)) }]}
				onLayout={({ nativeEvent }) => {
					if (closing || nativeEvent.layout.height === height.value) return;

					if (!settings.get('toasts.animations', true)) {
						height.value = nativeEvent.layout.height;
					} else {
						height.value = withSpring(nativeEvent.layout.height, {
							// overshootClamping: true,
							// restDisplacementThreshold: 0.01,
							// restSpeedThreshold: 2,
							damping: 11,
							// stiffness: 150
						});
					}
				}}
			>
				{settings.get('toasts.opacity', 0.8) !== 1 && <BackdropFilters.BackgroundBlurFill blurAmount={settings.get('toasts.blur', 0.15)} />}
				<View style={styles.wrapper}>
					{options.icon && <View style={[styles.icon, { marginVertical: linesLength * 10 }]}>
						{(options.tintedIcon ?? true) ? (
							<TintedIcon
								source={typeof options.icon === 'string' ? Icons[options.icon] : options.icon}
							/>
						) : (
							<Image
								source={typeof options.icon === 'string' ? Icons[options.icon] : options.icon}
								style={{
									width: 24,
									aspectRatio: 1
								}}
							/>
						)}
					</View>}
					<View style={styles.contentContainer}>
						{options.title && <Text style={styles.title}>
							{typeof options.title === 'function' ? createElement(options.title) : options.title}
						</Text>}
						{options.content && <Text
							style={styles.content}
							onTextLayout={({ nativeEvent: { lines: { length } } }) => {
								setLinesLength(length > 2 ? length + 1 : length);
							}}
						>
							{typeof options.content === 'function' ? createElement(options.content) : options.content}
						</Text>}
					</View>
					<Pressable
						style={[styles.icon, { marginRight: 12, marginVertical: linesLength * 10 }]}
						hitSlop={10}
						onPress={leave}
						// On long press, close all toasts.
						onLongPress={() => {
							Toasts.setState((prev) => {
								const toasts = { ...prev.toasts };

								for (const toast in toasts) {
									const options = toasts[toast];
									options.closing = true;
								}

								return { toasts };
							});
						}}
					>
						<TintedIcon source={Icons['ic_close']} />
					</Pressable>
				</View>
				{Array.isArray(options.buttons) && options.buttons.length !== 0 && (
					<View style={[styles.buttons, { marginTop: 5 }]}>
						{options.buttons.map((button, index) => <Design.Button
							key={`${options.id}-button-${index}`}
							style={styles.button}
							variant={button.variant || 'primary'}
							size={button.size || 'sm'}
							onPress={button.onPress}
							iconPosition={button.iconPosition || 'start'}
							icon={button.icon || undefined}
							text={button.content}
						/>)}
					</View>
				)}
				{(options.duration ?? settings.get('toasts.duration', 0)) > 0 && <Animated.View
					style={[
						{
							position: 'absolute',
							bottom: 0,
							left: 0,
							width,
							height: 3,
							borderRadius: 100000
						},
						styles.bar
					]}
				/>}
			</View>
		</Animated.View>
	</PanGestureHandler>;
}

export default Toast;