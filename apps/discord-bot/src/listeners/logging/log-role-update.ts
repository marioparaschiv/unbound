import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { Role } from 'discord.js';

import { describeChanges, describePermissionChanges } from '~/lib/log-changes';
import { roleSnapshot } from '~/logging/snapshots';
import { COLOURS } from '~/lib/constants';

/** Logs what changed on a role, as Carl-bot did; a move in the list alone is not logged. */
@ApplyOptions<Listener.Options>({ event: Events.GuildRoleUpdate })
export class LogRoleUpdateListener extends Listener<typeof Events.GuildRoleUpdate> {
	public override async run(before: Role, after: Role) {
		const { serverLog, config } = this.container;

		if (!serverLog || after.guild.id !== config.guildId) return;

		const lines = [
			...describeChanges(roleSnapshot(before), roleSnapshot(after)),
			...describePermissionChanges(before.permissions.bitfield, after.permissions.bitfield),
		];

		if (!lines.length) return;

		await serverLog.post({
			kind: 'misc',
			title: 'Role Updated',
			colour: COLOURS.info,
			lines: [`<@&${after.id}>`, ...lines],
			footer: after.id,
		});
	}
}
