import type { ImageSourcePropType } from 'react-native';
import { View, Image } from 'react-native';
import { memo } from 'react';

import { Icons } from '~/api/assets';

import TintedIcon from './tinted-icon';
import useStyles from './toast.style';

type ToastIconProps = {
	icon: string | number | ImageSourcePropType;
	tinted?: boolean;
};

function resolveIcon(icon: string | number): number {
	if (typeof icon === 'string') return Icons[icon] ?? 0;
	return icon;
}

function ToastIcon({ icon, tinted = true }: ToastIconProps) {
	const styles = useStyles();
	const source = resolveIcon(icon as string | number);

	return (
		<View style={styles.icon}>
			{tinted ? (
				<TintedIcon source={source} />
			) : (
				<Image source={source} style={{ width: 24, aspectRatio: 1 }} />
			)}
		</View>
	);
}

export default memo(ToastIcon);
