import { React, Reanimated, Gestures, ReactNative as RN } from '@metro/common';
import { RowIcon, TabsUIState } from '@ui/components/form';
import type { ToastOptions } from '@typings/api/toasts';
import { useSettingsStore } from '@api/storage';
import { Redesign } from '@metro/components';
import useToastState from './useToastState';
import useStyles from './toast.style';
import Toasts from '@stores/toasts';
import { Icons } from '@api/assets';

const { withSpring, withTiming, useSharedValue, default: { View } } = Reanimated;
const { PanGestureHandler, State } = Gestures;

function unprocessColor(int): string {
	return '#' + ('000000' + int.toString(16)).slice(-6);
}

function Toast(options: ToastOptions) {
	const { style, properties: { scale, opacity, height, width }, leave } = useToastState(options);
	const isTabsV2 = TabsUIState.useInMainTabsExperiment();
	const settings = useSettingsStore('unbound');
	const styles = useStyles();
	const translateY = useSharedValue(0);

	const onGestureEvent = (event) => {
		if (event.nativeEvent.translationY > 0) return;

		opacity.value = 1 - ((event.nativeEvent.translationY * -1) / 30);
		scale.value = 1 - ((event.nativeEvent.translationY * -1) / 500);
    translateY.value = event.nativeEvent.translationY;
  };

  const onHandlerStateChange = (event) => {
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
		<View key={options.id} style={{ ...style, transform: [{ scale }, { translateY }] }} pointerEvents='box-none'>
			<RN.View
				style={[styles.container, { backgroundColor: unprocessColor(ReactNative.processColor(styles.container.backgroundColor)) + 'fa' }]}
				onLayout={({ nativeEvent }) => height.value = settings.get('toasts.animations', true) ?
					withSpring(nativeEvent.layout.height) :
					nativeEvent.layout.height
				}
			>
				<RN.View style={styles.wrapper}>
					{options.icon && <RN.View style={styles.icon}>
						<RowIcon source={typeof options.icon === 'string' ? Icons[options.icon] : options.icon} size='small' />
					</RN.View>}
					<RN.View style={styles.contentContainer}>
						{options.title && <RN.Text style={styles.title}>
							{typeof options.title === 'function' ? React.createElement(options.title) : options.title}
						</RN.Text>}
						{options.content && <RN.Text style={styles.content}>
							{typeof options.content === 'function' ? React.createElement(options.content) : options.content}
						</RN.Text>}
					</RN.View>
					<RN.Pressable
						style={[styles.icon, { marginRight: 12 }]}
						hitSlop={10}
						onPress={leave}
						onLongPress={() => {
							RN.LayoutAnimation.configureNext({
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
						<RowIcon source={Icons['ic_close']} size='small' />
					</RN.Pressable>
				</RN.View>
				{Array.isArray(options.buttons) &&  options.buttons.length > 0 && (
					<RN.View style={[styles.buttons, { marginTop: isTabsV2 ? 0 : 8 }]}>
						{options.buttons.map((button, index) => <Redesign.Button
							key={`${options.id}-button-${index}`}
							style={styles.button}
							variant={button.variant || 'primary'}
							size={button.size || 'sm'}
							onPress={button.onPress}
							iconPosition={button.iconPosition || 'start'}
							icon={button.icon || undefined}
							text={button.content}
						/>)}
					</RN.View>
				)}
				{(options.duration ?? settings.get('toasts.duration', 0)) > 0 && settings.get('toasts.animations', true) && <View
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
			</RN.View>
		</View>
	</PanGestureHandler>;
}

export default Toast;