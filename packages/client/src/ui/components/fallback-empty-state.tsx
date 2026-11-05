import { View, Image } from 'react-native';

import { Discord } from '~/metro/components';
import { icons } from '~/assets/api';

import useStyles from './fallback-empty-state.style';

type FallbackEmptyStateProps = {
	children: string;
	/** The illustration's asset name. */
	image: string;
};

/**
 * @description Unbound's centered illustration and message, for Discord builds without their own `EmptyState`.
 */
function FallbackEmptyState({ children, image }: FallbackEmptyStateProps) {
	const styles = useStyles();

	return (
		<View style={styles.container}>
			<Image source={icons[image] ?? 0} resizeMode='contain' style={styles.image} />
			<Discord.Text variant='text-md/medium' style={styles.text}>
				{children}
			</Discord.Text>
		</View>
	);
}

export default FallbackEmptyState;
