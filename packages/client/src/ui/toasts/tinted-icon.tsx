import { Image } from 'react-native';
import { memo } from 'react';

import useStyles from './toast.style';

type TintedIconProps = {
	source: number;
	size?: number;
};

function TintedIcon({ source, size = 24 }: TintedIconProps) {
	const styles = useStyles();
	return <Image source={source} style={[styles.iconTint, { width: size, height: size }]} />;
}

export default memo(TintedIcon);
