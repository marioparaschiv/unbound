import { View } from 'react-native';

import { Discord } from '~/api/metro/components';
import { Messages } from '~/api/i18n';

/** @description Placeholder for the upcoming Cloud Sync settings. */
function CloudSyncPage() {
	return (
		<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
			<Discord.Text variant='text-lg/semibold' color='text-muted'>
				{Messages.UNBOUND_COMING_SOON}
			</Discord.Text>
		</View>
	);
}

export default CloudSyncPage;
