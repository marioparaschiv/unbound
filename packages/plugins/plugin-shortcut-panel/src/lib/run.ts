import { flux, plugins } from '@unbound-app/api';

import { optionFreeCommands } from '~/lib/available';
import type { Shortcut } from '~/lib/shortcuts';

type ChannelStore = { getChannel(id: string): { guild_id?: string | null } | undefined };

type GuildStore = { getGuild(id: string): unknown };

/**
 * @description Runs a shortcut: turns its plugin on or off, or runs its command in the channel as if typed.
 * @param shortcut The shortcut.
 * @param channelId The channel the panel was opened in.
 */
export async function runShortcut(shortcut: Shortcut, channelId: string): Promise<void> {
	if (shortcut.kind === 'plugin') {
		plugins.toggle(shortcut.pluginId);

		return;
	}

	const command = optionFreeCommands().find((entry) => entry.name === shortcut.command);
	const Channels = flux.getStore('Channel') as unknown as ChannelStore;
	const Guilds = flux.getStore('Guild') as unknown as GuildStore;
	const channel = Channels.getChannel(channelId);

	if (!command?.execute || !channel) return;

	try {
		await command.execute([], {
			channel,
			guild: channel.guild_id ? Guilds.getGuild(channel.guild_id) : undefined,
		});
	} catch (error) {
		logger.error(`Failed to run shortcut /${shortcut.command}:`, error);
	}
}

export default { runShortcut };
