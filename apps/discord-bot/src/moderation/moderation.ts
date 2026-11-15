import { createLogger } from '@unbound-app/logger';
import type { Client } from 'discord.js';

import { discordFailure, type MessageGateway, type OutgoingMessage } from '~/lib/discord-messages';
import { renderCaseNotice, renderCasePost, type CaseIcons, type CasePost } from '~/lib/case-post';
import { insertCase, listDueBans, updateCase, type CaseDraft } from '~/moderation/cases';
import type { CaseNotice, ModCase } from '~/lib/mod-case';
import createSerialQueue from '~/runtime/serial-queue';
import type { Database } from '~/db/database';

export type ModerationOptions = {
	db: Database;
	messages: MessageGateway;
	guildId: string;
	/** Where cases are posted; unset, cases are stored but not posted. */
	logChannelId: string | undefined;
	/** The command prefix the log's missing-reason hint names. */
	prefix: string;
	/** Uploads the action icon emojis, on `start`; until they resolve, posts show no icon. */
	loadIcons?: () => Promise<CaseIcons>;
	now?: () => number;
};

/** Records cases, keeps their mod log posts in step and lifts temporary bans. */
export type Moderation = {
	/** Stores a case and posts it to the mod log. */
	record: (draft: CaseDraft) => Promise<ModCase>;
	/** Renders a case as its mod log post. */
	render: (entry: ModCase) => CasePost;
	/** Sets a case's reason and edits its post. */
	setReason: (entry: ModCase, reason: string) => Promise<ModCase>;
	/** Marks a warning pardoned and edits its post. */
	pardon: (entry: ModCase) => Promise<ModCase>;
	/** DMs a user what was done to them; resolves to whether it was delivered. */
	notify: (userId: string, notice: CaseNotice, guildName: string) => Promise<boolean>;
	/** Uploads the icon emojis and starts lifting due temporary bans each minute. */
	start: (client: Client<true>) => void;
	stop: () => void;
};

const logger = createLogger('Bot', 'Moderation');
const EXPIRY_INTERVAL_MS = 60_000;

/**
 * @description Creates the moderation service behind the moderation commands and the manual-action listener.
 * @param options The database, Discord messages, guild, mod log channel and prefix.
 * @returns The service.
 */
export function createModeration(options: ModerationOptions): Moderation {
	const { db, messages, guildId, logChannelId, prefix, loadIcons, now = Date.now } = options;
	const queue = createSerialQueue();
	let timer: ReturnType<typeof setInterval> | undefined;
	let icons: CaseIcons = new Map();

	function logPost(entry: ModCase): OutgoingMessage {
		return renderCasePost(entry, prefix, icons);
	}

	async function post(entry: ModCase): Promise<ModCase> {
		if (!logChannelId) {
			return entry;
		}

		try {
			const logMessageId = await messages.post(logChannelId, logPost(entry));

			return (await updateCase(db, entry.id, { logChannelId, logMessageId })) ?? entry;
		} catch (error) {
			logger.error(`Failed to post case ${entry.id}:`, error);

			return entry;
		}
	}

	async function repost(entry: ModCase) {
		if (!entry.logChannelId || !entry.logMessageId) return;

		try {
			await messages.edit(entry.logChannelId, entry.logMessageId, logPost(entry));
		} catch (error) {
			if (discordFailure(error) !== 'gone') {
				logger.error(`Failed to edit the post of case ${entry.id}:`, error);
			}
		}
	}

	async function record(draft: CaseDraft) {
		return post(
			await insertCase(db, { ...draft, createdAt: draft.createdAt ?? new Date(now()) }),
		);
	}

	async function update(entry: ModCase, changes: Parameters<typeof updateCase>[2]) {
		const updated = (await updateCase(db, entry.id, changes)) ?? entry;

		await repost(updated);

		return updated;
	}

	async function liftDueBans(client: Client<true>) {
		const due = await listDueBans(db, new Date(now()));

		if (!due.length) return;

		const guild = await client.guilds.fetch(guildId);

		for (const ban of due) {
			try {
				await guild.bans.remove(ban.userId, `Temporary ban from case ${ban.id} expired.`);
			} catch (error) {
				// An unban by hand, outside Discord's audit log reach, leaves nothing to lift.
				if (discordFailure(error) !== 'gone') {
					logger.error(`Failed to lift the temporary ban of case ${ban.id}:`, error);
					continue;
				}
			}

			await record({
				action: 'unban',
				userId: ban.userId,
				userName: ban.userName,
				moderatorId: client.user.id,
				moderatorName: client.user.username,
				reason: `Temporary ban from case ${ban.id} expired.`,
			});
		}
	}

	return {
		record,
		render: (entry) => renderCasePost(entry, prefix, icons),
		setReason: (entry, reason) => update(entry, { reason }),
		pardon: (entry) => update(entry, { closedAt: new Date(now()) }),
		async notify(userId, notice, guildName) {
			try {
				await messages.dm(userId, renderCaseNotice(notice, guildName, icons));

				return true;
			} catch (error) {
				if (discordFailure(error) !== 'undeliverable') {
					logger.error(`Failed to DM user ${userId} about a ${notice.action}:`, error);
				}

				return false;
			}
		},
		start(client) {
			void loadIcons?.()
				.then((loaded) => {
					icons = loaded;
				})
				.catch((error: Error) => {
					logger.warn('Failed to upload the case icon emojis:', error);
				});

			// Serial, so a slow pass never overlaps the next and lifts a ban twice.
			async function tick() {
				try {
					await queue.enqueue(() => liftDueBans(client));
				} catch (error) {
					logger.error('Failed to lift the due temporary bans:', error);
				}
			}

			void tick();
			timer = setInterval(() => void tick(), EXPIRY_INTERVAL_MS);
		},
		stop() {
			clearInterval(timer);
		},
	};
}

export default { createModeration };
