import { React, Reanimated, ReactNative as RN } from '@metro/common';
import { RowIcon, TabsUIState } from '@ui/components/form';
import type { ToastOptions } from '@typings/api/toasts';
import { useSettingsStore } from '@api/storage';
import { Redesign } from '@metro/components';
import useToastState from './useToastState';
import useStyles from './toast.style';
import Toasts from '@stores/toasts';
import { Icons } from '@api/assets';

const { withSpring, default: { View } } = Reanimated;

function Toast(options: ToastOptions) {
	const { properties, leave } = useToastState(options);
	const isTabsV2 = TabsUIState.useInMainTabsExperiment();
	const settings = useSettingsStore('unbound');
	const styles = useStyles();

	return <View key={options.id} style={properties} pointerEvents='box-none'>
		<RN.View
			style={styles.container}
			onLayout={({ nativeEvent }) => properties.height.value = settings.get('toasts.animations', true) ?
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

						RN.LayoutAnimation.configureNext({
							duration: 1000,
							delete: {
								type: 'easeInEaseOut',
								property: 'scaleXY',
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
		</RN.View>
	</View>;
}

export default Toast;