import { createLogger } from '@unbound-app/logger';

import { renderLogPost, type LogEntry, type LogKind } from '~/lib/log-post';
import type { MessageGateway } from '~/lib/discord-messages';
import type { LogIcons } from '~/lib/log-icons';

export type ServerLogOptions = {
	messages: MessageGateway;
	/** The channel each kind of event goes to; an unset one is not logged. */
	channels: Readonly<Record<LogKind, string | undefined>>;
	/** Uploads the event icon emojis, on creation; until they resolve, posts show no icon. */
	loadIcons?: () => Promise<LogIcons>;
};

/** Posts the server's events to its log channels, as Carl-bot's logging did. */
export type ServerLog = {
	/** Posts an event; a failure is logged, never thrown, so one event cannot stop the next. */
	post: (entry: LogEntry) => Promise<void>;
	/** Whether a channel is a log channel, whose own messages are never logged. */
	isLogChannel: (channelId: string) => boolean;
};

const logger = createLogger('Bot', 'ServerLog');

/**
 * @description Creates the server log behind the logging listeners.
 * @param options The Discord messages, the log channels and the icon loader.
 * @returns The server log.
 */
export function createServerLog({ messages, channels, loadIcons }: ServerLogOptions): ServerLog {
	const logChannels = new Set(Object.values(channels).filter(Boolean));
	let icons: LogIcons = new Map();

	void loadIcons?.()
		.then((loaded) => {
			icons = loaded;
		})
		.catch((error: Error) => {
			logger.warn('Failed to upload the server log icon emojis:', error);
		});

	return {
		async post(entry) {
			const channelId = channels[entry.kind];

			if (!channelId) return;

			try {
				await messages.post(channelId, renderLogPost(entry, icons));
			} catch (error) {
				logger.error(`Failed to log ${entry.title} in channel ${channelId}:`, error);
			}
		},
		isLogChannel: (channelId) => logChannels.has(channelId),
	};
}

export default { createServerLog };
