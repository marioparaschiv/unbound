import { View, Image } from 'react-native';

import { Discord } from '~/api/metro/components';
import { Theme } from '~/api/metro/common';
import { Icons } from '~/api/assets';

import useStyles from './empty-state.style';

type EmptyProps = {
	children: string;
};

/**
 * @description Centered empty-state placeholder with an illustration and a message.
 */
function Empty({ children }: EmptyProps) {
	const styles = useStyles();

	return (
		<View style={styles.container}>
			<Image source={Icons['empty_state_image'] ?? 0} style={styles.image} />
			<Discord.Text variant='text-md/medium' style={{ color: Theme.colors.TEXT_MUTED }}>
				{children}
			</Discord.Text>
		</View>
	);
}

export default Empty;
