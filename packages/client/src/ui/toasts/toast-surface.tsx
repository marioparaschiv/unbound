import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useUnboundSettings } from '~/settings/unbound';
import { BackdropFilters } from '~/metro/components';

import { unitToHex, withoutOpacity } from './color';
import useStyles from './toast.style';

type ToastSurfaceProps = {
	children: ReactNode;
	/** Overrides the floating toast's layout, such as its absolute position. */
	style?: StyleProp<ViewStyle>;
	onLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * @description A toast's card: its background at the saved opacity, blurred behind by the saved amount.
 * Shared by real toasts and the settings preview so both always look the same.
 */
function ToastSurface({ children, style, onLayout }: ToastSurfaceProps) {
	const settings = useUnboundSettings(({ key }) => key?.startsWith('toasts'));
	const styles = useStyles();

	const opacity = settings.get('toasts.opacity');
	const background = withoutOpacity(styles.container.backgroundColor) + unitToHex(opacity);

	return (
		<View
			style={[styles.container, styles.toastShadow, { backgroundColor: background }, style]}
			onLayout={onLayout}
		>
			{opacity !== 1 ? (
				<BackdropFilters.BackgroundBlurFill blurAmount={settings.get('toasts.blur')} />
			) : null}
			{children}
		</View>
	);
}

export default ToastSurface;
