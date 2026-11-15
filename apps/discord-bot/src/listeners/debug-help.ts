import {
	DiscordAPIError,
	RESTJSONErrorCodes,
	type Message,
	type MessageReaction,
	type User,
} from 'discord.js';
import { parsePlist } from '@unbound-app/contracts/plist';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { createLogger } from '@unbound-app/logger';

import {
	diagnoseNotifications,
	isNotificationQuestion,
	readDebugPayload,
	readEntitlements,
	readTextReport,
	type DebugPayload,
	type Entitlements,
} from '~/lib/notification-diagnosis';
import {
	askForDebug,
	ASK_TTL_MS,
	dmSentMessage,
	OPEN_DMS_EMOJI,
	openDmsExpired,
	openDmsPrompt,
	type HelpTopic,
} from '~/lib/debug-prompts';
import { diagnoseScreenShare, isScreenShareQuestion } from '~/lib/screen-share-diagnosis';
import { renderNotificationHelp } from '~/lib/notification-replies';
import { renderScreenShareHelp } from '~/lib/screen-share-replies';

// A real entitlements plist is a few kilobytes.
const MAX_ENTITLEMENTS_BYTES = 64 * 1024;
const ENTITLEMENTS_FILE = 'Entitlements.xml';

/** The ask's outcome; a sent ask names its DM channel for the "Open DM" button. */
type DmResult = { status: 'sent'; channelId: string } | { status: 'closed' | 'failed' };

/** One reaction on the open-DMs prompt, and how to end the wait once the DM goes through. */
type DmRetry = {
	prompt: Message;
	reaction: MessageReaction;
	asker: User;
	guildName: string;
	topic: HelpTopic;
	stop: () => void;
};

/** An open ask: what it was about, and until when a `/debug` answers it. */
type Ask = { topic: HelpTopic; until: number };

const logger = createLogger('Bot', 'DebugHelp');

// Screen share goes first: "screen share notifications" is a screen share question.
function questionTopic(text: string): HelpTopic | undefined {
	if (isScreenShareQuestion(text)) {
		return 'screen-share';
	}

	return isNotificationQuestion(text) ? 'notifications' : undefined;
}

// The card's alt text carries the report; without a card, `/debug` sends it as Markdown.
function findDebugPayload(message: Message): DebugPayload | undefined {
	for (const attachment of message.attachments.values()) {
		const payload = attachment.description
			? readDebugPayload(attachment.description)
			: undefined;

		if (payload) {
			return payload;
		}
	}

	return readTextReport(message.content);
}

async function fetchEntitlements(message: Message): Promise<Entitlements | undefined> {
	const file = message.attachments.find((attachment) => attachment.name === ENTITLEMENTS_FILE);

	if (!file || file.size > MAX_ENTITLEMENTS_BYTES) {
		return undefined;
	}

	try {
		const response = await fetch(file.url);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		return readEntitlements(parsePlist(await response.text()));
	} catch (error) {
		logger.error(`Failed to read the entitlements of message ${message.id}:`, error);

		return undefined;
	}
}

async function clearReactions(prompt: Message) {
	try {
		await prompt.reactions.removeAll();
	} catch {
		// Needs Manage Messages; the stale ✅ is harmless once the prompt's text has changed.
	}
}

@ApplyOptions<Listener.Options>({ event: Events.MessageCreate })
export class DebugHelpListener extends Listener<typeof Events.MessageCreate> {
	// Who was asked, about what and until when; in memory, so a restart forgets open asks.
	private readonly asked = new Map<string, Ask>();

	public override async run(message: Message) {
		const inGuild = message.guildId === this.container.config.guildId;

		if (message.author.bot || !(inGuild || message.channel.isDMBased())) {
			return;
		}

		const payload = findDebugPayload(message);
		const topic = inGuild ? questionTopic(message.content) : undefined;

		if (payload) {
			await this.answerDebug(message, payload);
		} else if (topic) {
			await this.askForDebug(message, topic);
		}
	}

	private async askForDebug(message: Message, topic: HelpTopic) {
		const now = Date.now();

		for (const [userId, { until }] of this.asked) {
			if (until <= now) {
				this.asked.delete(userId);
			}
		}

		// One ask per open wait, so a user describing their problem over several messages is not spammed.
		if (this.asked.has(message.author.id)) {
			return;
		}

		this.asked.set(message.author.id, { topic, until: now + ASK_TTL_MS });

		try {
			const result = await this.sendAsk(message.author, topic);

			if (result.status === 'sent') {
				await message.reply(dmSentMessage(result.channelId, topic));
			} else if (result.status === 'closed') {
				await this.waitForOpenDms(message, topic);
			} else {
				// Discord itself failed; the next question tries again.
				this.asked.delete(message.author.id);
			}
		} catch (error) {
			logger.error(
				`Failed to ask ${message.author.id} for /debug in message ${message.id}:`,
				error,
			);
		}
	}

	private async sendAsk(user: User, topic: HelpTopic): Promise<DmResult> {
		try {
			const ask = await user.send(askForDebug(topic));

			// The `/debug` window starts when the DM arrives, not when the question was asked.
			this.asked.set(user.id, { topic, until: Date.now() + ASK_TTL_MS });

			return { status: 'sent', channelId: ask.channelId };
		} catch (error) {
			if (
				error instanceof DiscordAPIError &&
				error.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser
			) {
				return { status: 'closed' };
			}

			logger.error(`Failed to DM ${user.id} about ${topic}:`, error);

			return { status: 'failed' };
		}
	}

	// Waits for the asker, and only the asker, to react once their DMs are open, then retries the DM.
	private async waitForOpenDms(message: Message, topic: HelpTopic) {
		const asker = message.author;
		const guildName = message.guild?.name ?? 'the server';
		const prompt = await message.reply(openDmsPrompt(guildName, topic));

		await prompt.react(OPEN_DMS_EMOJI);

		const collector = prompt.createReactionCollector({
			filter: (reaction: MessageReaction, user: User) =>
				reaction.emoji.name === OPEN_DMS_EMOJI && user.id === asker.id,
			time: ASK_TTL_MS,
		});

		collector.on('collect', (reaction: MessageReaction) => {
			void this.retryDm({
				prompt,
				reaction,
				asker,
				guildName,
				topic,
				stop: () => collector.stop('sent'),
			});
		});
		collector.on('end', (_collected, reason) => {
			if (reason !== 'sent') {
				void this.expireDmPrompt(prompt, asker, topic);
			}
		});
	}

	private async retryDm({ prompt, reaction, asker, guildName, topic, stop }: DmRetry) {
		try {
			const result = await this.sendAsk(asker, topic);

			if (result.status === 'sent') {
				stop();
				await prompt.edit(dmSentMessage(result.channelId, topic));
				await clearReactions(prompt);

				return;
			}

			// A failed send has no DM to point at, so it asks for another reaction like a closed one.
			await prompt.edit(openDmsPrompt(guildName, topic, true));
			// Lets them react again; needs Manage Messages, so a failure only costs the retry.
			await reaction.users.remove(asker.id).catch((cause: unknown) => {
				logger.warn(`Failed to clear the reaction of ${asker.id} on ${prompt.id}:`, cause);
			});
		} catch (error) {
			logger.error(`Failed to retry the DM to ${asker.id} from prompt ${prompt.id}:`, error);
		}
	}

	private async expireDmPrompt(prompt: Message, asker: User, topic: HelpTopic) {
		this.asked.delete(asker.id);

		try {
			await prompt.edit(openDmsExpired(topic));
			await clearReactions(prompt);
		} catch (error) {
			logger.error(`Failed to expire the DM prompt ${prompt.id}:`, error);
		}
	}

	private async answerDebug(message: Message, payload: DebugPayload) {
		const ask = this.asked.get(message.author.id);

		if (!ask || ask.until <= Date.now()) {
			return;
		}

		this.asked.delete(message.author.id);

		// Only text reports and cards from older servers lack the entitlements in the payload.
		const entitlements = payload.entitlements ?? (await fetchEntitlements(message));
		const reply =
			ask.topic === 'screen-share'
				? renderScreenShareHelp(diagnoseScreenShare(payload, entitlements))
				: renderNotificationHelp({
						view: 'simple',
						askerId: message.author.id,
						facts: diagnoseNotifications(payload, entitlements),
					});

		try {
			await message.reply(reply);
		} catch (error) {
			logger.error(`Failed to answer the /debug in message ${message.id}:`, error);
		}
	}
}
