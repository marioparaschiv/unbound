import type { IconInput } from '@unbound-app/types/components';
import type { ImageSourcePropType } from 'react-native';
import { isValidElement, memo } from 'react';
import { View, Image } from 'react-native';

import TintedIcon from '~/metro/fallbacks/tinted-icon';
import { icons } from '~/assets/api';

import isIconComponent from './is-icon-component';
import useStyles from './toast.style';

type ToastIconProps = {
	icon: string | IconInput | ImageSourcePropType;
	tinted?: boolean;
};

function resolveIcon(icon: string | number | ImageSourcePropType): ImageSourcePropType {
	return typeof icon === 'string' ? (icons[icon] ?? 0) : icon;
}

function ToastIcon({ icon, tinted = true }: ToastIconProps) {
	const styles = useStyles();

	if (isValidElement(icon)) {
		return <View style={styles.icon}>{icon}</View>;
	}

	if (isIconComponent(icon)) {
		const Icon = icon;

		return (
			<View style={styles.icon}>
				<Icon size='md' />
			</View>
		);
	}

	const source = resolveIcon(icon);

	return (
		<View style={styles.icon}>
			{tinted ? (
				<TintedIcon source={source} />
			) : (
				<Image source={source} style={styles.image} />
			)}
		</View>
	);
}

export default memo(ToastIcon);
