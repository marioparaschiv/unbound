import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { View } from 'react-native';

import styles from '~/components/new-tag.style';

function NewTag() {
	return (
		<View style={styles.tag}>
			<Discord.Text variant='text-xxs/bold' color='white'>
				{messages.NEW}
			</Discord.Text>
		</View>
	);
}

export default NewTag;
