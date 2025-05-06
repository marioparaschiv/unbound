import { Discord } from '@api/metro/components';
import { View, Image } from 'react-native';
import { Icons } from '@api/assets';

import useStyles from './empty-state.style';


export const Empty = ({ children }) => {
	const styles = useStyles();

	return <View style={styles.empty}>
		<Image
			style={styles.emptyImage}
			source={Icons['img_search_empty_dark']}
		/>
		<Discord.Text variant='text-md/semibold' color='text-muted' style={styles.emptyMessage}>
			{children}
		</Discord.Text>
	</View>;
};

export default Empty;