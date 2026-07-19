import { View, Image } from 'react-native';

import { Discord } from '~/api/metro/components';
import { Theme } from '~/api/metro/common';
import { Icons } from '~/api/assets';

import useStyles from './empty-state.style';

type EmptyProps = {
	children: string;
	image?: string;
};

/**
 * @description Centered empty-state placeholder with an illustration and a message. The illustration
 * defaults to the generic empty-state image; pass `image` to use a context-specific asset name.
 */
function Empty({ children, image = 'empty_state_image' }: EmptyProps) {
	const styles = useStyles();

	return (
		<View style={styles.container}>
			<Image source={Icons[image] ?? 0} resizeMode='contain' style={styles.image} />
			<Discord.Text variant='text-md/medium' style={{ color: Theme.colors.TEXT_MUTED }}>
				{children}
			</Discord.Text>
		</View>
	);
}

export default Empty;
