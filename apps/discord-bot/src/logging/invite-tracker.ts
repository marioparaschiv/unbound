import { createLogger } from '@unbound-app/logger';
import type { Guild } from 'discord.js';

import { findUsedInvite, type InviteUse } from '~/lib/invite-uses';
import createSerialQueue from '~/runtime/serial-queue';

/** Tells which invite each new member joined with, for the join log; needs the Manage Server permission. */
export type InviteTracker = {
	/** Reads the invites as they are now, so the next join has something to compare against. */
	prime: () => Promise<void>;
	/** Rereads the invites after a join and returns the one used; undefined when it cannot tell. */
	findUsed: () => Promise<InviteUse | undefined>;
};

const logger = createLogger('Bot', 'Invites');

async function readInvites(guild: Guild) {
	const invites = new Map<string, InviteUse>();
	const fetched = await guild.invites.fetch({ cache: false });

	for (const invite of fetched.values()) {
		invites.set(invite.code, {
			code: invite.code,
			uses: invite.uses ?? 0,
			maxUses: invite.maxUses ?? 0,
			inviterId: invite.inviterId ?? undefined,
		});
	}

	if (guild.vanityURLCode) {
		const vanity = await guild.fetchVanityData();

		invites.set(vanity.code ?? guild.vanityURLCode, {
			code: vanity.code ?? guild.vanityURLCode,
			uses: vanity.uses,
			maxUses: 0,
			vanity: true,
		});
	}

	return invites;
}

/**
 * @description Creates the invite tracker for one guild.
 * @param guild The guild whose invites are tracked.
 * @returns The tracker.
 */
export function createInviteTracker(guild: Guild): InviteTracker {
	// Joins are compared one at a time, so two close joins never read the same "before".
	const queue = createSerialQueue();
	let known = new Map<string, InviteUse>();

	async function prime() {
		try {
			known = await readInvites(guild);
		} catch (error) {
			logger.warn(`Failed to read the invites of guild ${guild.id}:`, error);
		}
	}

	return {
		prime,
		async findUsed() {
			let used: InviteUse | undefined;

			await queue.enqueue(async () => {
				const before = known;

				await prime();
				used = findUsedInvite(before, known);
			});

			return used;
		},
	};
}

export default { createInviteTracker };
