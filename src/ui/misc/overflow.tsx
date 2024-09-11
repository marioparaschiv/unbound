import { TouchableOpacity, type ImageStyle } from 'react-native';
import { Design } from '@api/metro/components';
import { TintedIcon } from '@ui/misc/forms';
import type { ComponentType } from 'react';
import { Icons } from '@api/assets';

interface OverflowItem {
	label: string;
	IconComponent?: ComponentType;
	iconSource?: number;
	action: () => any;
}

interface OverflowProps {
	items: OverflowItem[] | Array<OverflowItem[]>,
	title?: string;
	iconSource?: number;
	scale?: number;
	style?: ImageStyle;
}

export default function Overflow(props: OverflowProps) {
	const { items, title, iconSource = Icons['MoreHorizontalIcon'], scale = 1, style = {} } = props;

	return <Design.ContextMenu items={items} title={title}>
		{(props, onPress, accessibilityState, accessibilityActions, onAccessibilityAction) => (
			<TouchableOpacity
				{...props}
				onPress={onPress}
				accessibilityState={accessibilityState}
				accessibilityActions={accessibilityActions}
				onAccessibilityAction={onAccessibilityAction}
			>
				<TintedIcon
					source={iconSource}
					style={{
						transform: [{ scale }],
						marginLeft: 8,
						marginRight: 10,
						...style
					}}
				/>
			</TouchableOpacity>
		)}
	</Design.ContextMenu>;
};