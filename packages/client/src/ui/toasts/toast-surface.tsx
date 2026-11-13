import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useUnboundSettings } from '~/settings/unbound';
import { BackdropFilters } from '~/metro/components';

import { readableSurface, unitToHex, withoutOpacity } from './color';
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
	// A theme can pair a surface with text that does not read on it; the toast keeps its text readable regardless.
	const surface = readableSurface(
		withoutOpacity(styles.container.backgroundColor),
		withoutOpacity(styles.mutedText.color),
	);
	const background = surface + unitToHex(opacity);
	const blurred = opacity !== 1;

	return (
		<View
			style={[
				styles.container,
				styles.toastShadow,
				{ backgroundColor: blurred ? 'transparent' : background },
				style,
			]}
			onLayout={onLayout}
		>
			{/* The surface colour tints the blur from above. Discord's own tint and Android fallback are a dark scrim that
				drowns a light theme's text, so both are replaced. */}
			{blurred ? (
				<BackdropFilters.BackgroundBlurFill
					blurAmount={settings.get('toasts.blur')}
					tintColor={background}
					android_fallbackColor={background}
				/>
			) : null}
			{children}
		</View>
	);
}

export default ToastSurface;
