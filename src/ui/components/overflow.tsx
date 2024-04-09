import { ReactNative as RN } from '@metro/common';
import { TintedIcon } from '@ui/components/misc';
import type { ViewStyle } from 'react-native';
import { Redesign } from '@metro/components';
import { Icons } from '@api/assets';

interface OverflowItem {
	label: string;
	IconComponent?: React.ComponentType;
	iconSource?: number;
	action: () => any;
}

interface OverflowProps {
	items: OverflowItem[] | Array<OverflowItem[]>,
	title?: string;
	iconSource?: number;
	scale?: number;
	style?: ViewStyle
}

export default function Overflow({ items, title, iconSource = Icons['MoreHorizontalIcon'], scale = 1, style = {} }: OverflowProps) {
	return <Redesign.ContextMenu items={items} title={title}>
		{(props, onPress, accessibilityState, accessibilityActions, onAccessibilityAction) => (
			<RN.TouchableOpacity
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
			</RN.TouchableOpacity>
		)}
	</Redesign.ContextMenu>;
};