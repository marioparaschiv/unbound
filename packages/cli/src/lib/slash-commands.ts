// Each function here runs on the device through `toDeviceCode`, so none may reach outside its own body.
import type { DevicePrelude } from '~/lib/device-prelude';

type Reply = { content?: string; embeds?: { title?: string }[] };

type RawOption = { type: number; name: string; value: string | number | boolean };

type CommandChannel = { id: string; guild_id?: string | null };

type CommandGuild = { id: string };

type CommandRunContext = { channel: CommandChannel; guild: CommandGuild | null };

type DiscordOption = { name: string; type: number; required?: boolean };

type DiscordCommand = {
	name?: string;
	options?: DiscordOption[];
	execute?: (raw: RawOption[], context: CommandRunContext) => Promise<Reply | undefined>;
};

/** What `ubd debug command` reports: the command it ran, where, and the reply Discord would have sent. */
export type SlashCommandRun = {
	command: string;
	channelId: string;
	reply: { content?: string; embeds?: number } | null;
};

/**
 * @description Runs a slash command from Discord's `/` list the way the picker would, without sending its reply: a
 * public reply comes back to the caller instead, and an ephemeral one shows only in the channel on the device.
 * @param device The device prelude.
 * @param name The command, with its subcommands after a space, such as `petpet` or `convert usd`.
 * @param options The command's options by name, as text; numbers and booleans are converted for the option's type.
 * @param channelId The channel to run it in; the one open on the device when `null`.
 * @returns The command, the channel and the reply it returned.
 */
export async function runSlashCommand(
	{ unbound }: DevicePrelude,
	name: string,
	options: Record<string, string>,
	channelId: string | null,
): Promise<SlashCommandRun> {
	const CHAT_INPUT = 1;
	const NUMBER_TYPES = new Set([4, 10]);
	const BOOLEAN_TYPE = 5;
	const Commands = unbound.metro.findByProps('getBuiltInCommands');
	const Channels = unbound.flux.getStore('Channel');
	const Selected = unbound.flux.getStore('SelectedChannel');
	const Guilds = unbound.flux.getStore('Guild');

	if (!Commands || !Channels) {
		throw new Error("Discord's command or channel module is missing.");
	}

	const listed: DiscordCommand[] = Commands.getBuiltInCommands([CHAT_INPUT], true, true);
	const all = listed.filter((candidate) => typeof candidate.name === 'string');
	const command = all.find((candidate) => candidate.name === name.replace(/^\//, ''));

	if (!command?.execute) {
		const names = all.map((candidate) => `/${candidate.name}`).join(', ');

		throw new Error(`No slash command /${name}. The device has: ${names}.`);
	}

	const id = channelId ?? Selected?.getChannelId?.();
	const channel: CommandChannel | undefined = id ? Channels.getChannel(id) : undefined;

	if (!id || !channel) {
		throw new Error(
			channelId
				? `No channel ${channelId} on the device.`
				: 'No channel is open on the device; pass --channel.',
		);
	}

	const known = command.options ?? [];
	const raw = Object.entries(options).map(([key, text]): RawOption => {
		const option = known.find((candidate) => candidate.name === key);

		if (!option) {
			const valid = known.map((candidate) => candidate.name).join(', ') || 'none';

			throw new Error(`/${command.name} has no option ${key}; its options: ${valid}.`);
		}

		const value = NUMBER_TYPES.has(option.type)
			? Number(text)
			: option.type === BOOLEAN_TYPE
				? text === 'true'
				: text;

		return { type: option.type, name: key, value };
	});
	const missing = known.filter((option) => option.required && !(option.name in options));

	if (missing.length) {
		throw new Error(
			`/${command.name} needs ${missing.map((option) => option.name).join(', ')}.`,
		);
	}

	const guild = (channel.guild_id ? Guilds?.getGuild?.(channel.guild_id) : undefined) ?? null;
	const reply = await command.execute(raw, { channel, guild });

	return {
		command: `/${command.name}`,
		channelId: id,
		reply: reply ? { content: reply.content, embeds: reply.embeds?.length } : null,
	};
}

export default { runSlashCommand };
