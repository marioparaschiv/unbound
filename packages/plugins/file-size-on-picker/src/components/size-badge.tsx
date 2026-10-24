import { metro } from '@unbound-app/api';
import { Text, View } from 'react-native';

import { BADGE_INSET } from '~/constants';

type SizeBadgeProps = {
	label: string;
	left: number;
};

function SizeBadge({ label, left }: SizeBadgeProps) {
	return (
		<View
			pointerEvents='none'
			style={{
				backgroundColor: '#1e1f2280',
				borderRadius: 4,
				left,
				paddingHorizontal: 4,
				paddingVertical: 2,
				position: 'absolute',
				top: BADGE_INSET,
			}}
		>
			<Text
				style={{
					color: 'white',
					fontFamily: metro.common.Constants.Fonts.PRIMARY_BOLD,
					fontSize: 10,
					includeFontPadding: false,
				}}
			>
				{label}
			</Text>
		</View>
	);
}

export default SizeBadge;
