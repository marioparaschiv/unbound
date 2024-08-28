import type { GestureEvent, HandlerStateChangeEvent, PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import { View, Image, Text, Pressable, LayoutAnimation } from 'react-native';
import { Reanimated, Gestures } from '@api/metro/common';
import type { ToastOptions } from '@typings/api/toasts';
import { unitToHex, withoutOpacity } from '@utilities';
import { useSettingsStore } from '@api/storage';
import { createElement, useState } from 'react';
import { Design } from '@api/metro/components';
import { TintedIcon } from '@ui/misc/forms';
import { Icons } from '@api/assets';
import Toasts from '@stores/toasts';

import useToastState from './useToastState';
import useStyles from './toast.style';

const { withSpring, withTiming, useSharedValue, default: Animated } = Reanimated;
const { PanGestureHandler, State } = Gestures;

function Toast(options: ToastOptions) {
	const { style, properties: { scale, opacity, height, width }, leave } = useToastState(options);
	const settings = useSettingsStore('unbound');
	const translateY = useSharedValue(0);
	const styles = useStyles();

	// Default for if there is no content at all
	const [linesLength, setLinesLength] = useState(1);

	const onGestureEvent = (event: GestureEvent<PanGestureHandlerEventPayload>) => {
		if (event.nativeEvent.translationY > 0) return;

		opacity.value = 1 - ((event.nativeEvent.translationY * -1) / 30);
		scale.value = 1 - ((event.nativeEvent.translationY * -1) / 500);
		translateY.value = event.nativeEvent.translationY;
	};

	const onHandlerStateChange = (event: HandlerStateChangeEvent<PanGestureHandlerEventPayload>) => {
		if (event.nativeEvent.oldState !== State.ACTIVE) return;

		if (event.nativeEvent.translationY < -30) {
			leave();
		} else {
			scale.value = withTiming(1);
			opacity.value = withTiming(1);
			translateY.value = withTiming(0);
		}
	};

	return <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
		<Animated.View key={options.id} style={[{ ...style, transform: [{ scale }, { translateY }] }]} pointerEvents='box-none'>
			<View style={styles.toastShadow}>
				<View
					style={[styles.container, { backgroundColor: withoutOpacity(styles.container.backgroundColor) + unitToHex(settings.get('toasts.opacity', 0.8)) }]}
					onLayout={({ nativeEvent }) => height.value = settings.get('toasts.animations', true) ?
						withSpring(nativeEvent.layout.height) :
						nativeEvent.layout.height
					}
				>
					<Design.BackgroundBlurFill blurAmount={settings.get('toasts.blur', 0.15)} />
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
							onLongPress={() => {
								LayoutAnimation.configureNext({
									duration: 1000,
									delete: {
										type: 'easeInEaseOut',
										property: 'opacity',
										duration: 300
									}
								});

								Toasts.store.setState(() => ({ toasts: [] }));
							}}
						>
							<TintedIcon source={Icons['ic_close']} />
						</Pressable>
					</View>
					{Array.isArray(options.buttons) && options.buttons.length > 0 && (
						<View style={[styles.buttons, { marginTop: 0 }]}>
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
					{(options.duration ?? settings.get('toasts.duration', 0)) > 0 && settings.get('toasts.animations', true) && <Animated.View
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
			</View>
		</Animated.View>
	</PanGestureHandler>;
}

export default Toast;