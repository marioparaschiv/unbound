import { View, Image } from 'react-native';

import { Discord } from '~/api/metro/components';
import { getIDByName } from '~/api/assets';

import useStyles from './empty-state.style';

type EmptyProps = {
	children: string;
};

/**
 * @description Centered empty-state placeholder with an illustration and a message.
 */
function Empty({ children }: EmptyProps) {
	const styles = useStyles();
	const source = getIDByName('img_search_empty_dark');

	return (
		<View style={styles.container}>
			{source ? <Image source={source} style={styles.image} /> : null}
			<Discord.Text variant='text-md/medium' color='text-muted'>
				{children}
			</Discord.Text>
		</View>
	);
}

export default Empty;
