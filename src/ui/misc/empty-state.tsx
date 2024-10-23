import { View, Text, Image } from 'react-native';
import { Icons } from '@api/assets';

import useStyles from './empty-state.style';


export const Empty = ({ children }) => {
	const styles = useStyles();

	return <View style={styles.empty}>
		<Image
			style={styles.emptyImage}
			source={Icons['img_connection_empty_dark']}
		/>
		<Text style={styles.emptyMessage}>
			{children}
		</Text>
	</View>;
};

export default Empty;