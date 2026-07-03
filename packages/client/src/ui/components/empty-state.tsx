import { View, Image } from 'react-native';

import { Discord } from '~/api/metro/components';
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
			<Image source={Icons['img_search_empty_dark']} style={styles.image} />
			<Discord.Text variant='text-md/medium' color='text-muted'>
				{children}
			</Discord.Text>
		</View>
	);
}

export default Empty;
