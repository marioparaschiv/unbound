import { metro } from '@unbound-app/api';

import { PLATFORM_ICONS, type Platform } from '~/lib/constants';
import { useStatusColor } from '~/lib/theme';

type PlatformIconProps = {
	platform: string;
	status: string;
	small: boolean;
};

function PlatformIcon({ platform, status, small }: PlatformIconProps) {
	const color = useStatusColor(status);
	const { Svg, Path } = metro.common.SVG;
	const shape = PLATFORM_ICONS[platform as Platform] ?? PLATFORM_ICONS.desktop;
	const size = shape.size - (small ? 3 : 0);

	return (
		<Svg width={size} height={size} viewBox={shape.viewBox} fill={color}>
			<Path d={shape.path} />
		</Svg>
	);
}

export default PlatformIcon;
