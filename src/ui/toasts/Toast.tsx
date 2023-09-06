import { Constants, React, Reanimated, ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import { RowIcon } from '@ui/components/form-handler';
import { ToastOptions } from '@typings/api/toasts';
import { Redesign } from '@metro/components';
import { Icons } from '@api/assets';
import { useToastState } from '@ui/toasts/useToastState';

const { withSpring, default: { View } } = Reanimated;

function Toast(options: ToastOptions) {
	const { properties: { marginTop, opacity, height, scale }, leave } = useToastState(options);

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
					variant={button.variant || 'primary'}
					size={button.size || 'sm'}
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
		backgroundColor: Theme.colors.BACKGROUND_PRIMARY,
		alignSelf: 'center',
		borderRadius: 18,
		width: 250,
		position: 'absolute',
		zIndex: 2,
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
		marginVertical: 20,
		marginLeft: 12
	},
	buttons: {
		flexWrap: 'wrap',
		flexDirection: 'row',
		marginHorizontal: 8,
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