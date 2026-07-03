import type { ColorValue } from 'react-native';
import { Image } from 'react-native';
import { memo } from 'react';

import { Theme } from '~/api/metro/common';

type TintedIconProps = {
	source: number;
	size?: number;
	tint?: ColorValue;
};

/**
 * @description An image tinted with a theme colour, defaulting to the interactive icon colour.
 */
function TintedIcon({
	source,
	size = 24,
	tint = Theme.colors.INTERACTIVE_ICON_DEFAULT,
}: TintedIconProps) {
	return <Image source={source} style={{ width: size, height: size, tintColor: tint }} />;
}

export default memo(TintedIcon);
