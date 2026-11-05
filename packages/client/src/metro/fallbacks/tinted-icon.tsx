import type { ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';
import { Image } from 'react-native';
import { memo } from 'react';

import useStyles from './tinted-icon.style';

type TintedIconProps = {
	source: ImageSourcePropType;
	size?: number;
	/** A style from the caller's `createStyles` setting `tintColor`; the interactive icon colour when omitted. */
	style?: StyleProp<ImageStyle>;
};

/**
 * @description An image tinted with a theme colour, defaulting to the interactive icon colour.
 */
function TintedIcon({ source, size = 24, style }: TintedIconProps) {
	const styles = useStyles();

	return <Image source={source} style={[styles.icon, { width: size, height: size }, style]} />;
}

export default memo(TintedIcon);
