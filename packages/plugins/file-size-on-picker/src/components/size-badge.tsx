import { Discord } from '@unbound-app/api/metro/components';
import { View } from 'react-native';

import { BADGE_INSET } from '~/lib/constants';

type SizeBadgeProps = {
	label: string;
	left: number;
};

function SizeBadge({ label, left }: SizeBadgeProps) {
	return (
		<View
			pointerEvents='none'
			style={{
				// A scrim over the photo, the same in every theme, as Discord's video-duration pill draws it.
				backgroundColor: '#1e1f2280',
				borderRadius: 4,
				left,
				paddingHorizontal: 4,
				paddingVertical: 2,
				position: 'absolute',
				top: BADGE_INSET,
			}}
		>
			<Discord.Text variant='text-xxs/semibold' color='text-overlay-light'>
				{label}
			</Discord.Text>
		</View>
	);
}

export default SizeBadge;
