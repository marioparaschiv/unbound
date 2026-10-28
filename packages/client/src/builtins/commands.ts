import type { EphemeralReply, IconSource } from '@unbound-app/types/commands';
import { createLogger } from '@unbound-app/logger';

import {
	DEFAULT_ENUMS,
	isOverridableDenial,
	toDescriptor,
	toDiscordCommand,
	withSections,
} from '~/lib/commands/discord';
import type {
	CommandEnums,
	DiscordCommand,
	IndexSection,
	IndexState,
} from '~/lib/commands/discord';
import type { CommandRecord, Section } from '~/lib/commands/normalize';
import { UNBOUND_ICON } from '~/lib/commands/unbound-icon';
import { commandId } from '~/lib/commands/normalize';
import { Clyde, Commands, Dispatcher } from '~/api/metro/common';
import type { CommandEffects } from '~/lib/commands/run';
import { findByProps, findStore } from '~/api/metro';
import { registry } from '~/lib/commands/registry';
import { createExecute } from '~/lib/commands/run';
import { createPatcher } from '~/api/patcher';
import { getIDByName } from '~/api/assets';
import { Messages } from '~/api/metro/api';
import { Users } from '~/api/metro/stores';

/** The Discord side of one registry version. */
type DiscordIndex = {
	version: number;
	sections: Record<string, IndexSection>;
	commands: DiscordCommand[];
	sectionIds: ReadonlySet<string>;
	icons: ReadonlyMap<string, IconSource>;
};

type MemoState = {
	version: number;
	state: IndexState;
};

const Patcher = createPatcher('unbound::commands');
const Logger = createLogger('Commands');
const DEFAULT_ICON = 'ic_application_command_24px';

// Keeps each unchanged command's identity across versions, so Discord's memoized lists stay valid.
const discordCommands = new WeakMap<CommandRecord, DiscordCommand>();
const states = new WeakMap<IndexState, MemoState>();
// Bot avatars this built-in added, keyed by section, removed again on stop.
const avatars = new Set<string>();
let enums: CommandEnums = DEFAULT_ENUMS;
let effects: CommandEffects | undefined;
let IndexStore: ReturnType<typeof findStore> | undefined;
let unsubscribe: (() => void) | undefined;
let index: DiscordIndex | undefined;
let pendingChange = false;
let nonce = 0;

/** Shows registered commands in Discord's `/` picker and runs them. */
export function start() {
	enums = readEnums();
	IndexStore = findStore('ApplicationCommandIndex');

	patchIndex();
	patchAccess();
	patchIcons();
	patchBuiltIns();
	patchInstall();

	unsubscribe = registry.subscribe(scheduleChange);
	scheduleChange();
}

/** Removes the commands from Discord. The registry keeps them for the next start. */
export function stop() {
	unsubscribe?.();
	unsubscribe = undefined;
	Patcher.unpatchAll();
	removeAvatars();
	index = undefined;
	IndexStore?.emitChange?.();
}

function readEnums(): CommandEnums {
	const Types = findByProps('ApplicationCommandOptionType', 'ApplicationCommandType');
	const Inputs = findByProps('ApplicationCommandInputType', 'ApplicationCommandSectionType');

	return {
		chat: Types?.ApplicationCommandType?.CHAT ?? DEFAULT_ENUMS.chat,
		builtInText:
			Inputs?.ApplicationCommandInputType?.BUILT_IN_TEXT ?? DEFAULT_ENUMS.builtInText,
		builtInSection:
			Inputs?.ApplicationCommandSectionType?.BUILT_IN ?? DEFAULT_ENUMS.builtInSection,
		subCommand: Types?.ApplicationCommandOptionType?.SUB_COMMAND ?? DEFAULT_ENUMS.subCommand,
		subCommandGroup:
			Types?.ApplicationCommandOptionType?.SUB_COMMAND_GROUP ?? DEFAULT_ENUMS.subCommandGroup,
	};
}

function createEffects(): CommandEffects {
	const Channels = findStore('Channel');
	const Roles = findStore('GuildRole');

	return {
		resolvers: {
			user: (id) => Users.getUser?.(id) ?? undefined,
			channel: (id) => Channels?.getChannel?.(id) ?? undefined,
			role: (guildId, id) =>
				guildId ? (Roles?.getRole?.(guildId, id) ?? undefined) : undefined,
		},
		showEphemeral,
		dispatch: (action) => Dispatcher.dispatch(action),
		nonce: () => `${Date.now()}${nonce++}`,
		reportError: (record, error) =>
			Logger.error(`/${record.path.join(' ')} from ${record.owner} failed:`, error),
	};
}

function showEphemeral(channelId: string, reply: EphemeralReply, section: Section) {
	const message = Clyde.createBotMessage({
		channelId,
		content: reply.content ?? '',
		embeds: reply.embeds ?? [],
	});

	message.author = {
		...message.author,
		// Clyde's id would group the reply under Clyde's avatar.
		id: commandId('unbound:author', section.id),
		username: section.name,
		avatar: registerAvatar(section),
	};

	Messages.receiveMessage(channelId, message, true);
}

// Discord draws a bot author's avatar from BOT_AVATARS[author.avatar]: an asset id or an image uri string.
function registerAvatar(section: Section): string | undefined {
	const Avatars = findByProps('BOT_AVATARS', 'ensureAvatarSource');

	if (!Avatars?.BOT_AVATARS) return;

	const key = `unbound:${section.id}`;

	Avatars.BOT_AVATARS[key] = section.icon ?? UNBOUND_ICON;
	avatars.add(key);

	return key;
}

function removeAvatars() {
	const Avatars = findByProps('BOT_AVATARS', 'ensureAvatarSource');

	for (const key of avatars) {
		delete Avatars?.BOT_AVATARS?.[key];
	}

	avatars.clear();
}

function getIndex(): DiscordIndex {
	const snapshot = registry.snapshot();

	if (index?.version === snapshot.version) {
		return index;
	}

	const sections: Record<string, IndexSection> = {};
	const commands: DiscordCommand[] = [];
	const icons = new Map<string, IconSource>();

	for (const { section, commands: records } of snapshot.sections) {
		const byId: Record<string, DiscordCommand> = {};

		for (const record of records) {
			const command = discordCommand(record);

			byId[command.id] = command;
			commands.push(command);
		}

		const icon = section.icon ?? getIDByName(DEFAULT_ICON);

		sections[section.id] = { descriptor: toDescriptor(section, enums), commands: byId };

		if (icon !== undefined) {
			icons.set(section.id, icon);
		}
	}

	index = {
		version: snapshot.version,
		sections,
		commands,
		sectionIds: snapshot.sectionIds,
		icons,
	};

	return index;
}

function discordCommand(record: CommandRecord): DiscordCommand {
	const known = discordCommands.get(record);

	if (known) {
		return known;
	}

	effects ??= createEffects();

	const command = toDiscordCommand(record, createExecute(record, effects), enums);

	discordCommands.set(record, command);

	return command;
}

function scheduleChange() {
	if (pendingChange) return;

	pendingChange = true;

	void Promise.resolve().then(() => {
		pendingChange = false;
		IndexStore?.emitChange?.();
	});
}

function patchIndex() {
	if (typeof IndexStore?.getUserState !== 'function') {
		Logger.error(
			'Failed to find ApplicationCommandIndexStore.getUserState; commands will not show.',
		);

		return;
	}

	Patcher.after(IndexStore, 'getUserState', ({ result }) => {
		if (!result) return;

		const { version, sections } = getIndex();
		const memo = states.get(result);

		if (memo?.version === version) {
			return memo.state;
		}

		const state = withSections(result, sections);

		states.set(result, { version, state });

		return state;
	});
}

function patchAccess() {
	const Access = findByProps('hasAccess', 'HasAccessResult');

	if (!Access) {
		Logger.error(
			'Failed to find hasAccess; commands may be hidden where permissions are missing.',
		);

		return;
	}

	Patcher.after(Access, 'hasAccess', ({ args: [command], result }) => {
		if (!getIndex().sectionIds.has(command?.applicationId)) return;

		if (isOverridableDenial(result, Access.HasAccessResult)) {
			return Access.HasAccessResult.ALLOWED;
		}
	});
}

function patchIcons() {
	const Icons = findByProps('getApplicationCommandsIconSource');

	if (!Icons) {
		Logger.error(
			'Failed to find getApplicationCommandsIconSource; sections will show no icon.',
		);

		return;
	}

	Patcher.after(Icons, 'getApplicationCommandsIconSource', ({ args: [section] }) => {
		const icon = getIndex().icons.get(section?.id);

		if (icon === undefined) return;

		return typeof icon === 'number' ? icon : { uri: icon };
	});
}

function patchBuiltIns() {
	if (typeof Commands?.getBuiltInCommands !== 'function') {
		Logger.error(
			'Failed to find getBuiltInCommands; commands will not show in text-only channels.',
		);

		return;
	}

	// Discord drops every non-built-in section where only text commands are allowed.
	Patcher.after(Commands, 'getBuiltInCommands', ({ args: [types, , textOnly], result }) => {
		if (!textOnly || !Array.isArray(types) || !types.includes(enums.chat)) return;

		const present = new Set(result.map((command: DiscordCommand) => command.id));
		const missing = getIndex().commands.filter((command) => !present.has(command.id));

		return missing.length ? [...result, ...missing] : result;
	});
}

function patchInstall() {
	const Install = findByProps('installApplicationOnDemandIfNeeded');

	if (!Install) {
		Logger.error('Failed to find installApplicationOnDemandIfNeeded; commands may not run.');

		return;
	}

	// Sending a command first installs its application, which fetches /applications/<id>/public and rejects for ours.
	Patcher.instead(
		Install,
		'installApplicationOnDemandIfNeeded',
		({ args, original, this: self }) => {
			if (getIndex().sectionIds.has(args[0]?.applicationId)) {
				return Promise.resolve({ isAuthorized: true });
			}

			return original.apply(self, args);
		},
	);
}

export default { start, stop };
