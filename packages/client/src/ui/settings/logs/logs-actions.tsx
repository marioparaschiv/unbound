import { createLogger } from '@unbound-app/logger';
import { Share } from 'react-native';

import { messages, format } from '~/i18n/api';
import { formatLogEntry } from '~/logs/entry';
import { Discord } from '~/metro/components';
import { Clipboard } from '~/metro/common';
import { icons } from '~/assets/api';
import { show } from '~/toasts/api';

import type { LogLine } from './use-log-stream';

const Logger = createLogger('Logs', 'Actions');

type LogsActionsProps = {
	/** The lines shown, oldest first. */
	lines: LogLine[];
	paused: boolean;
	onTogglePause: () => void;
};

const asText = (lines: LogLine[]) => lines.map(formatLogEntry).join('\n');

function copy(lines: LogLine[]) {
	Clipboard.setString(asText(lines));
	show({ content: format('UNBOUND_LOGS_COPIED', { count: lines.length }), icon: 'CopyIcon' });
}

function share(lines: LogLine[]) {
	Share.share({ message: asText(lines) }).catch((cause: unknown) => {
		Logger.error(`Failed to share ${lines.length} log lines:`, cause);
	});
}

/**
 * @description The Logs page's buttons: pause or resume the list, and copy or share the lines it shows.
 */
function LogsActions({ lines, paused, onTogglePause }: LogsActionsProps) {
	return (
		<>
			<Discord.IconButton
				icon={icons[paused ? 'PlayIcon' : 'PauseIcon'] ?? 0}
				variant='secondary'
				size='sm'
				accessibilityLabel={
					paused ? messages.UNBOUND_LOGS_RESUME : messages.UNBOUND_LOGS_PAUSE
				}
				onPress={onTogglePause}
			/>
			<Discord.IconButton
				icon={icons.CopyIcon ?? 0}
				variant='secondary'
				size='sm'
				accessibilityLabel={messages.UNBOUND_LOGS_COPY}
				onPress={() => copy(lines)}
			/>
			<Discord.IconButton
				icon={icons.ShareIcon ?? 0}
				variant='secondary'
				size='sm'
				accessibilityLabel={messages.UNBOUND_LOGS_SHARE}
				onPress={() => share(lines)}
			/>
		</>
	);
}

export default LogsActions;
