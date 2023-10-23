import { Icons } from '@api/assets';
import { ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import { Redesign } from '@metro/components';
import type { ReactElement } from 'react';

interface OverflowItem {
	label: string;
	IconComponent?: ReactElement;
	iconSource: number;
	action: () => any;
}

const styles = StyleSheet.createThemedStyleSheet({
	icon: {
		width: 16,
		aspectRatio: 1,
		marginRight: 10,
		tintColor: Theme.colors.INTERACTIVE_NORMAL
	}
})

export default ({ items }: { items: OverflowItem[] }) => {
	return <Redesign.ContextMenu
		items={items}
		children={(args, onPress, accessibilityState, accessibilityActions, onAccessibilityAction) => (
			<RN.TouchableOpacity
				{...args}
				onPress={onPress}
				accessibilityState={accessibilityState}
				accessibilityActions={accessibilityActions}
				onAccessibilityAction={onAccessibilityAction}
			>
				<RN.Image source={Icons['MoreHorizontalIcon']} style={styles.icon} />
			</RN.TouchableOpacity>
		)}
	/>
}