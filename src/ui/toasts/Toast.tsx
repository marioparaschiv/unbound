import { Constants, React, Reanimated, ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import { RowIcon, TabsUIState } from '@ui/components/form';
import { ToastOptions } from '@typings/api/toasts';
import { Redesign } from '@metro/components';
import useToastState from './useToastState';
import Toasts from '@stores/toasts';
import { Icons } from '@api/assets';

const { withSpring, default: { View } } = Reanimated;

function Toast(options: ToastOptions) {
	const { properties, leave } = useToastState(options);
	const tabsEnabled = TabsUIState.useInMainTabsExperiment();
	const styles = useStyles();

	return <View key={options.id} style={properties}>
		<RN.View style={styles.container} onLayout={({ nativeEvent }) => properties.height.value = withSpring(nativeEvent.layout.height)}>
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
					// activeOpacity={0.5}
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
			{Array.isArray(options.buttons) && (
				<RN.View style={[styles.buttons, { marginTop: tabsEnabled ? 0 : 8 }]}>
					{options.buttons.map(button => <Redesign.Button
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
		</RN.View>
	</View>;
}

const useStyles = StyleSheet.createStyles({
	container: {
		backgroundColor: Theme.colors.BACKGROUND_SECONDARY_ALT,
		alignSelf: 'center',
		borderRadius: 18,
		width: 250,
		position: 'absolute',
		padding: 2,
		marginHorizontal: 60,
		marginTop: 12,
		...Theme.shadows.SHADOW_BORDER
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
		marginVertical: 10,
		marginLeft: 12
	},
	buttons: {
		flexWrap: 'wrap',
		flexDirection: 'row',
		marginHorizontal: 12,
		marginBottom: 8,
		gap: 5
	},
	button: {
		width: '45%',
		flexGrow: 1,
		justifyContent: 'space-between'
	}
});

export default Toast;