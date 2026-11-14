import { getNativeLogs } from '~/native/unbound-native';
import Empty from '~/ui/components/empty-state';
import { messages } from '~/i18n/api';

import LogsView from './logs-view';

/**
 * @description The Logs page: live lines from Unbound, Discord's JS, React Native and native code, or why it cannot
 * show them on a loader from before the log stream.
 */
function LogsPage() {
	const logs = getNativeLogs();

	return logs ? (
		<LogsView logs={logs} />
	) : (
		<Empty icon='PaperIcon'>{messages.UNBOUND_LOGS_UNSUPPORTED}</Empty>
	);
}

export default LogsPage;
