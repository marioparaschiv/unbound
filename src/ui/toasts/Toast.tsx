import { Constants, React, Reanimated, ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import { RowIcon } from '@ui/components/form-handler';
import { get, useSettingsStore } from '@api/storage';
import { InternalToastOptions } from '@typings/api/toasts';
import { Icons } from '@api/assets';
import Toasts from '@stores/toasts';

const { useSharedValue, withSpring, withTiming, default: { View } } = Reanimated;
const { LayoutAnimation: { configureNext } } = RN;

function useToastState(options: InternalToastOptions) {
	const [leaving, setLeaving] = React.useState(false);

	const opacity = useSharedValue(0);
	const marginTop = useSharedValue(-30);

	const settings = useSettingsStore('unbound');
	const animations = settings.get('toasts.animations', true);

	function enter() {
		opacity.value = withTiming(1, { duration: 400 });
		marginTop.value = withSpring(0);
	}

	function leave() {
		animations && configureNext({
			duration: 1000,
			update: {
				type: 'spring',
				springDamping: 0.6
			},
			delete: {
				type: 'easeInEaseOut',
				property: 'scaleXY',
				duration: 300
			}
		});

		Toasts.store.setState((prev) => {
			delete prev.toasts[options.id];
			return prev;
		});
	}

	React.useEffect(() => {
		const timeout = setTimeout(
			() => setLeaving(true),
			(options.duration ?? get('unbound', 'toasts.duration', 1)) * 1000
		);

		return () => clearTimeout(timeout);
	}, []);

	React.useEffect(() => {
		leaving ? leave() : enter();
	}, [leaving]);

	React.useEffect(() => {
		options.closing && leave();
	}, [options]);

	return {
		style: {
			opacity: animations ? opacity : 1,
			marginTop: animations ? marginTop : 0,
			marginBottom: 15
		},
		enter,
		leave
	};
}

function Toast(options: InternalToastOptions) {
	const { style, leave } = useToastState(options);
	const { icon } = options;

	return <View style={style}>
		<RN.View style={styles.container}>
			<RN.View style={styles.wrapper}>
				{icon && <RN.View style={styles.icon}>
					<RowIcon source={typeof icon === 'string' ? Icons[icon] : icon} />
				</RN.View>}
				<RN.View style={styles.contentContainer}>
					<RN.Text style={styles.title}>
						{options.title}
					</RN.Text>
					<RN.Text style={styles.content}>
						{typeof options.content === 'function' ? React.createElement(options.content) : options.content}
					</RN.Text>
				</RN.View>
				<RN.TouchableOpacity
					style={[styles.icon, { marginRight: 12 }]}
					activeOpacity={0.5}
					onPress={leave}
				>
					<RowIcon source={Icons['ic_close']} />
				</RN.TouchableOpacity>
			</RN.View>
		</RN.View>
	</View>;
}

const styles = StyleSheet.createThemedStyleSheet({
	container: {
		backgroundColor: Theme.colors.BACKGROUND_TERTIARY,
		alignSelf: 'center',
		borderRadius: 25,
		minHeight: 50,
		width: 250,
		position: 'relative',
		zIndex: 2,
		marginHorizontal: 60,
		...Theme.shadows.SHADOW_BORDER
	},
	wrapper: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
	},
	contentContainer: {
		marginLeft: 12,
		flex: 1,
		flexDirection: 'column',
		flexGrow: 1
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
	}
});

export default Toast;