import { Constants, React, Reanimated, ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import { RowIcon } from '@ui/components/form-handler';
import { ToastOptions } from '@typings/api/toasts';
import { useSettingsStore } from '@api/storage';
import { Redesign } from '@metro/components';
import { Icons } from '@api/assets';
import Toasts from '@stores/toasts';

const { useSharedValue, withTiming, withSpring, default: { View }, runOnJS } = Reanimated;

function Toast(options: ToastOptions) {
	const [leaving, setLeaving] = React.useState(false);

	const settings = useSettingsStore('unbound', ({ key }) => key.startsWith('toasts'));

	const marginTop = useSharedValue(-5);
	const scale = useSharedValue(0.75);
	const opacity = useSharedValue(0);
	const height = useSharedValue(0);

	function leave() {
		marginTop.value = withTiming(-5);
		scale.value = withTiming(0.75);
		opacity.value = withTiming(0);
		height.value = withSpring(0, null, (finished) => finished && runOnJS(setLeaving)(true));
	}

	React.useEffect(() => {
		marginTop.value = withTiming(0);
		opacity.value = withTiming(1);
		scale.value = withTiming(1);

		const duration = (options.duration ?? settings.get('toasts.duration', 0));
		if (duration !== 0) {
			const timeout = setTimeout(leave, duration * 1000);
			return () => clearTimeout(timeout);
		}
	}, []);

	// On hidden
	React.useEffect(() => {
		if (leaving) {
			Toasts.store.setState((prev) => {
				delete prev.toasts[options.id];
				return prev;
			});
		}
	}, [leaving]);

	return <View key={options.id} style={{ marginTop, opacity, height, transform: [{ scale }] }}>
		<RN.View style={styles.container} onLayout={({ nativeEvent }) => height.value = withSpring(nativeEvent.layout.height)}>
			<RN.View style={styles.wrapper}>
				{options.icon && <RN.View style={styles.icon}>
					<RowIcon source={typeof options.icon === 'string' ? Icons[options.icon] : options.icon} size='small' />
				</RN.View>}
				<RN.View style={styles.contentContainer}>
					{options.title && <RN.Text style={styles.title}>
						{typeof options.title === 'function' ? React.createElement(options.title) : options.title}
					</RN.Text>}
					<RN.Text style={styles.content}>
						{typeof options.content === 'function' ? React.createElement(options.content) : options.content}
					</RN.Text>
				</RN.View>
				<RN.Pressable
					style={[styles.icon, { marginRight: 12 }]}
					hitSlop={10}
					// activeOpacity={0.5}
					onPress={leave}
				>
					<RowIcon source={Icons['ic_close']} size='small' />
				</RN.Pressable>
			</RN.View>
			{Array.isArray(options.buttons) && <RN.View style={styles.buttons}>
				{options.buttons.map(button => <Redesign.Button
					style={styles.button}
					variant={button.variant?.toUpperCase() || 'primary'}
					size={button.size?.toUpperCase() || 'sm'}
					onPress={button.onPress}
					iconPosition={button.iconPosition || 'start'}
					icon={button.icon || undefined}
					text={button.content}
				/>)}
			</RN.View>}
		</RN.View>
	</View>;
}

const styles = StyleSheet.createThemedStyleSheet({
	container: {
		backgroundColor: Theme.colors.BACKGROUND_SECONDARY,
		borderColor: Theme.colors.BACKGROUND_TERTIARY,
		borderWidth: 1,
		alignSelf: 'center',
		borderRadius: 15,
		width: 250,
		position: 'absolute',
		zIndex: 2,
		padding: 2,
		marginHorizontal: 60,
		...Theme.shadows.SHADOW_MEDIUM
	},
	wrapper: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center'
	},
	contentContainer: {
		marginLeft: 12,
		flex: 1,
		flexDirection: 'column',
		justifyContent: 'center',
	},
	title: {
		fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
		color: Theme.colors.TEXT_NORMAL,
		fontSize: 14
	},
	content: {
		fontFamily: Constants.Fonts.PRIMARY_NORMAL,
		color: Theme.colors.TEXT_MUTED,
		fontSize: 12
	},
	icon: {
		marginVertical: 20,
		marginLeft: 12
	},
	buttons: {
		flexWrap: 'wrap',
		flexDirection: 'row',
		gap: 5
	},
	button: {
		width: '45%',
		flexGrow: 1,
		justifyContent: 'space-between'
	}
});

export default Toast;