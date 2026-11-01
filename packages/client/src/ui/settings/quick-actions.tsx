import { View } from 'react-native';

import { readDebugInfo, readEntitlements } from '~/diagnostics/debug-report';
import { issueURL } from '~/diagnostics/issue-report';
import { Discord } from '~/metro/components';
import { Screens } from '~/core/constants';
import { messages } from '~/i18n/api';
import { Linking } from '~/metro/api';

import confirmRestart from './confirm-restart';
import useStyles from './quick-actions.style';
import QuickAction from './quick-action';

/**
 * @description The row of tiles under the Unbound banner: restart, check for updates and report an issue.
 */
function QuickActions() {
	const styles = useStyles();
	const navigation = Discord.useNavigation();

	return (
		<View style={styles.row}>
			<QuickAction
				label={messages.UNBOUND_RESTART}
				icon='RetryIcon'
				onPress={confirmRestart}
			/>
			<QuickAction
				label={messages.UNBOUND_UPDATES}
				icon='DownloadIcon'
				onPress={() => navigation.push(Screens.Updates)}
			/>
			<QuickAction
				label={messages.UNBOUND_QUICK_REPORT}
				icon='BugIcon'
				onPress={() => Linking.openURL(issueURL(readDebugInfo(), readEntitlements()))}
			/>
		</View>
	);
}

export default QuickActions;
