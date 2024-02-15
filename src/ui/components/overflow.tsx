import { ReactNative as RN } from '@metro/common';
import { TintedIcon } from '@ui/components/misc';
import { Redesign } from '@metro/components';
import { Icons } from '@api/assets';

interface OverflowItem {
	label: string;
	IconComponent?: React.ComponentType;
	iconSource?: number;
	action: () => any;
}

interface OverflowProps {
	items: OverflowItem[],
	iconSource?: number;
	scale?: number;
}

export default function Overflow({ items, iconSource = Icons['MoreHorizontalIcon'], scale = 1 }: OverflowProps) {
	return <Redesign.ContextMenu items={items}>
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
						marginRight: 10
					}}
				/>
			</RN.TouchableOpacity>
		)}
	</Redesign.ContextMenu>;
};