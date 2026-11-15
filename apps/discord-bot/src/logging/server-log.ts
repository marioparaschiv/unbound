import { createLogger } from '@unbound-app/logger';

import { renderLogPost, type LogEntry, type LogKind } from '~/lib/log-post';
import type { MessageGateway } from '~/lib/discord-messages';

export type ServerLogOptions = {
	messages: MessageGateway;
	/** The channel each kind of event goes to; an unset one is not logged. */
	channels: Readonly<Record<LogKind, string | undefined>>;
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
 * @param options The Discord messages and the log channels.
 * @returns The server log.
 */
export function createServerLog({ messages, channels }: ServerLogOptions): ServerLog {
	const logChannels = new Set(Object.values(channels).filter(Boolean));

	return {
		async post(entry) {
			const channelId = channels[entry.kind];

			if (!channelId) return;

			try {
				await messages.post(channelId, renderLogPost(entry));
			} catch (error) {
				logger.error(`Failed to log ${entry.title} in channel ${channelId}:`, error);
			}
		},
		isLogChannel: (channelId) => logChannels.has(channelId),
	};
}

export default { createServerLog };
