import Animated from 'react-native-reanimated';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import usePopMotion from './use-pop-motion';

type PopInProps = {
	visible: boolean;
	children: ReactNode;
};

/**
 * @description Pops a floating button in and out: it scales from nothing as it fades up, and stays mounted until its
 * exit finishes. Renders an empty slot while hidden.
 */
function PopIn({ visible, children }: PopInProps) {
	const { mounted, style } = usePopMotion(visible);

	return mounted ? (
		<Animated.View style={style} pointerEvents={visible ? 'auto' : 'none'}>
			{children}
		</Animated.View>
	) : (
		<View />
	);
}

export default PopIn;
