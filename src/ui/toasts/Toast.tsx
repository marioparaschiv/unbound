import { Constants, React, Reanimated, ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import { ToastOptions } from '@typings/api/toasts';
import Toasts from '@stores/toasts';
import { Icons } from '@api/assets';
import { get, useSettingsStore } from '@api/storage';
import { RowIcon } from '@ui/components/FormHandler';

const { useSharedValue, withSpring, withTiming, default: { View } } = Reanimated;
const { LayoutAnimation: { Presets, configureNext } } = RN;

function useToastState(options: ToastOptions) {
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
                type: 'keyboard', 
                property: 'scaleXY', 
                duration: 400 
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

function Toast(options: ToastOptions) {
	const { style, leave } = useToastState(options);
	const { icon } = options;

	return <View style={style}>
		<RN.View style={styles.contentContainer}>
			<RN.View
				style={{
					flex: 1,
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				{icon && <RN.View style={styles.icon}>
					<RowIcon
						source={typeof icon === 'string' ? Icons[icon] : icon}
					/>
				</RN.View>}

				<RN.View
					style={{
						marginLeft: 12,
						flex: 1,
						flexDirection: 'column',
						flexGrow: 1
					}}
				>
					<RN.Text style={styles.title}>
						{options.title}
					</RN.Text>
					<RN.Text style={styles.content}>
						{typeof options.content === 'function'
							? React.createElement(options.content)
							: options.content}
					</RN.Text>
				</RN.View>

				<RN.TouchableOpacity
					style={[styles.icon, { marginRight: 12 }]}
					activeOpacity={0.5}
					onPress={leave}
				>
					<RowIcon
						source={Icons['ic_close']}
					/>
				</RN.TouchableOpacity>
			</RN.View>
		</RN.View>
	</View>;
}

const styles = StyleSheet.createThemedStyleSheet({
	contentContainer: {
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
	title: {
		fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
		color: Theme.colors.TEXT_NORMAL
	},
	content: {
		color: Theme.colors.TEXT_MUTED
	},
	icon: {
		marginVertical: 20,
		marginLeft: 12
	}
});

export default Toast;