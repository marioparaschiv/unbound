import { Platform, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { Screens } from '~/metro/common';

type ToastOverlayProps = {
	children: ReactNode;
};

function ToastOverlay({ children }: ToastOverlayProps) {
	if (Platform.OS === 'android') {
		return (
			<View style={StyleSheet.absoluteFill} pointerEvents='box-none'>
				{children}
			</View>
		);
	}

	return <Screens.FullWindowOverlay>{children}</Screens.FullWindowOverlay>;
}

export default ToastOverlay;
