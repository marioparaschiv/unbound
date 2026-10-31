import type { CommandRecord, Section } from '~/lib/commands/normalize';
import type { DiscordOptionExtras } from '~/lib/commands/options';
import type { DiscordExecute } from '~/lib/commands/run';

/** Discord's enum values these mappers emit. The commands built-in reads them from Discord at runtime. */
export type CommandEnums = {
	chat: number;
	builtInText: number;
	builtInSection: number;
	subCommand: number;
	subCommandGroup: number;
};

/** The values build 349 uses. */
export const DEFAULT_ENUMS: CommandEnums = {
	chat: 1,
	builtInText: 1,
	builtInSection: 0,
	subCommand: 1,
	subCommandGroup: 2,
};

export type DiscordChoice = {
	name: string;
	displayName: string;
	value: string | number;
};

export type DiscordOption = DiscordOptionExtras & {
	name: string;
	displayName: string;
	description: string;
	displayDescription: string;
	type: number;
	required: boolean;
	choices?: DiscordChoice[];
};

export type DiscordSubCommandStep = {
	name: string;
	type: number;
	displayName: string;
};

export type DiscordRootCommand = {
	id: string;
	name: string;
	untranslatedName: string;
	displayName: string;
	untranslatedDescription: string;
	displayDescription: string;
	type: number;
	inputType: number;
	applicationId: string;
};

export type DiscordCommand = DiscordRootCommand & {
	options: DiscordOption[];
	subCommandPath?: DiscordSubCommandStep[];
	rootCommand?: DiscordRootCommand;
	execute: DiscordExecute;
};

export type SectionDescriptor = {
	id: string;
	type: number;
	name: string;
};

export type IndexSection = {
	descriptor: SectionDescriptor;
	commands: Record<string, DiscordCommand>;
};

export type IndexResult = {
	sections: Record<string, IndexSection>;
	sectionIdsByBotId: Record<string, string>;
	version: number | string;
};

/** ApplicationCommandIndexStore's user state. A stale state has no `result`. */
export type IndexState = {
	serverVersion: number;
	fetchState: Record<string, boolean | number | undefined>;
	result?: IndexResult;
};

// Never equal to Discord's numeric serverVersion, so a state we fill in stays stale and Discord still fetches.
const STALE_VERSION = 'unbound:stale';

/**
 * @description Maps a record to Discord's client command shape. `applicationId` is the section id, because
 * the picker finds a row's section by it.
 * @param record The record.
 * @param execute The record's runtime execute.
 * @param enums Discord's enum values.
 * @returns The Discord command.
 */
export function toDiscordCommand(
	record: CommandRecord,
	execute: DiscordExecute,
	enums: CommandEnums = DEFAULT_ENUMS,
): DiscordCommand {
	const [root, ...subpath] = record.path;
	const name = record.path.join(' ');
	const base = {
		type: enums.chat,
		inputType: enums.builtInText,
		applicationId: record.section.id,
	};
	const command: DiscordCommand = {
		...base,
		id: record.id,
		name,
		untranslatedName: name,
		displayName: name,
		untranslatedDescription: record.description,
		displayDescription: record.description,
		options: record.options.map((option) => ({
			...option.extras,
			name: option.name,
			displayName: option.name,
			description: option.description,
			displayDescription: option.description,
			type: option.type,
			required: option.required,
			choices: option.choices?.map((choice) => ({
				name: choice.label,
				displayName: choice.label,
				value: choice.value,
			})),
		})),
		execute,
	};

	if (!subpath.length) {
		return command;
	}

	return {
		...command,
		subCommandPath: subpath.map((step, index) => ({
			name: step,
			displayName: step,
			type: index === subpath.length - 1 ? enums.subCommand : enums.subCommandGroup,
		})),
		rootCommand: {
			...base,
			id: record.rootId,
			name: root,
			untranslatedName: root,
			displayName: root,
			untranslatedDescription: record.rootDescription,
			displayDescription: record.rootDescription,
		},
	};
}

/**
 * @description Builds a section descriptor. `name` stays a plain string because Discord lowercases it to score.
 * @param section The section.
 * @param enums Discord's enum values.
 * @returns The descriptor.
 */
export function toDescriptor(
	section: Section,
	enums: CommandEnums = DEFAULT_ENUMS,
): SectionDescriptor {
	return { id: section.id, type: enums.builtInSection, name: section.name };
}

/**
 * @description Returns Discord's user index state with extra sections added, leaving the original untouched.
 * @param state The original user state.
 * @param sections The sections to add, keyed by section id.
 * @returns The new state, or the original when there is nothing to add.
 */
export function withSections(
	state: IndexState,
	sections: Record<string, IndexSection>,
): IndexState {
	if (!state || !Object.keys(sections).length) {
		return state;
	}

	const result = state.result ?? { sections: {}, sectionIdsByBotId: {}, version: STALE_VERSION };

	return { ...state, result: { ...result, sections: { ...result.sections, ...sections } } };
}

/**
 * @description Tells whether a hasAccess result is a permission denial Unbound overrides for its own commands.
 * Wrong type, NSFW and predicate failures stay denied.
 * @param result The hasAccess result.
 * @param results Discord's HasAccessResult enum.
 * @returns Whether to answer ALLOWED instead.
 */
export function isOverridableDenial(result: number, results: Record<string, number>): boolean {
	const kept = [
		results.ALLOWED,
		results.WRONG_COMMAND_TYPE,
		results.NSFW_NOT_ALLOWED,
		results.PREDICATE_FAILED,
	];

	return !kept.includes(result);
}
