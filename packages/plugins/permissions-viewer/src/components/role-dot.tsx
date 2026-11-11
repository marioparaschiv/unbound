import { View } from 'react-native';

import { FALLBACK_ROLE_COLOR } from '~/lib/constants';

type RoleDotProps = {
	color?: string | null;
	size?: number;
};

function RoleDot({ color, size = 12 }: RoleDotProps) {
	return (
		<View
			style={{
				backgroundColor: color || FALLBACK_ROLE_COLOR,
				borderRadius: size / 2,
				height: size,
				width: size,
			}}
		/>
	);
}

export default RoleDot;
