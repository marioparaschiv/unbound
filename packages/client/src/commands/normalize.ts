import type {
	Autocomplete,
	Awaitable,
	CommandContext,
	IconSource,
	OptionKind,
	OptionSpec,
	OptionValue,
	Reply,
	SectionInput,
} from '@unbound-app/types/commands';

import type { DiscordOptionExtras } from '~/commands/options';
import type { CommandLocales } from '~/commands/locales';
import { UNBOUND_ICON } from '~/commands/unbound-icon';
import { getKind } from '~/commands/options';

/** A picker section. Its id is also every one of its commands' `applicationId`. */
export type Section = {
	readonly id: string;
	readonly name: string;
	readonly icon: IconSource | undefined;
};

export type NormalizedChoice = {
	/** The message key of the label. */
	readonly label: string;
	readonly value: string;
};

export type ErasedArgs = Readonly<Record<string, OptionValue<OptionKind> | undefined>>;

/** An author's `execute` with its args type erased. */
export type ErasedExecute = (args: ErasedArgs, context: CommandContext) => Awaitable<Reply>;

export type ErasedAutocomplete = Autocomplete<string | number>;

export type NormalizedOption = {
	readonly name: string;
	/** The message key of the description; `undefined` shows the option's name. */
	readonly description: string | undefined;
	readonly kind: OptionKind;
	readonly type: number;
	readonly required: boolean;
	readonly choices: readonly NormalizedChoice[] | undefined;
	readonly extras: DiscordOptionExtras;
	readonly autocomplete: ErasedAutocomplete | undefined;
};

/** One runnable leaf, the unit the registry stores. `/plugins enable` has the path `['plugins', 'enable']`. */
export type CommandRecord = {
	/** Derived from the owner and path only, so it is stable across reloads. */
	readonly id: string;
	/** The root command's id; equal to `id` for a root leaf. */
	readonly rootId: string;
	/** The message key of the root's description. */
	readonly rootDescription: string;
	readonly owner: string;
	readonly section: Section;
	/** Resolves every message key of the record in the user's locale. */
	readonly locales: CommandLocales;
	/** 1 to 3 names: root, optional group, subcommand. */
	readonly path: readonly string[];
	/** The message key of the description. */
	readonly description: string;
	/** Required options first, then optional ones, each in declaration order. */
	readonly options: readonly NormalizedOption[];
	readonly execute: ErasedExecute;
};

/** A command or group as `register` receives it, before validation. */
export type ErasedNode = {
	description: string;
	options?: Readonly<Record<string, OptionSpec>>;
	execute?: ErasedExecute;
	subcommands?: ErasedTree;
};

export type ErasedTree = Readonly<Record<string, ErasedNode>>;

export type NormalizeInput = {
	owner: string;
	section: Section;
	tree: ErasedTree;
	/** The owner's translations, which every message key must be in. */
	locales: CommandLocales;
	/** Discord's SUB_COMMAND_KEY_SEPARATOR. */
	separator?: string;
};

type Walk = {
	owner: string;
	section: Section;
	locales: CommandLocales;
	separator: string;
	rootId: string;
	rootDescription: string;
	records: CommandRecord[];
};

const UNBOUND_SECTION_ID = 'unbound';
const SUB_COMMAND_SEPARATOR = '\u0000';

const NAME = /^[-_\p{L}\p{N}]{1,32}$/u;
const MAX_DEPTH = 3;
const MAX_ENTRIES = 25;
const MAX_TEXT = 100;
const SOURCE_FILE = 'i18n/en-US.json';
// Discord's own built-ins use -1..-99.
const RESERVED_IDS = 100;

/** Thrown by `register` for a tree Discord would reject. Nothing from that call is registered. */
export class CommandDefinitionError extends Error {
	/**
	 * @description Creates the error with a message naming the owner and the command.
	 * @param owner The owner that registered the command.
	 * @param path The command's path, space-separated.
	 * @param reason Which rule the command breaks.
	 */
	constructor(
		public readonly owner: string,
		public readonly path: string,
		reason: string,
	) {
		super(`Invalid command "/${path}" from ${owner}: ${reason}`);
		this.name = 'CommandDefinitionError';
	}
}

/**
 * @description Resolves an owner's section: its own, keyed by the owner, or the shared Unbound section.
 * @param owner The owner id.
 * @param input The section the owner asked for, if any.
 * @returns The section. The shared one shows the Unbound logo; an owner's section without an icon gets a default.
 */
export function resolveSection(owner: string, input: SectionInput | undefined): Section {
	if (!input) {
		return { id: UNBOUND_SECTION_ID, name: 'Unbound', icon: UNBOUND_ICON };
	}

	if (typeof input.name !== 'string' || !input.name.trim()) {
		throw new CommandDefinitionError(owner, '', 'a section needs a name.');
	}

	return { id: `${UNBOUND_SECTION_ID}:${owner}`, name: input.name.trim(), icon: input.icon };
}

/**
 * @description Validates an author's tree and flattens it into one record per runnable leaf.
 * @param input The owner, section, tree and separator.
 * @returns The records, roots in declaration order.
 */
export function normalize(input: NormalizeInput): CommandRecord[] {
	const { owner, section, tree, locales, separator = SUB_COMMAND_SEPARATOR } = input;
	const records: CommandRecord[] = [];

	for (const [name, node] of Object.entries(tree)) {
		const walk: Walk = {
			owner,
			section,
			locales,
			separator,
			rootId: commandId(owner, name),
			rootDescription: node?.description,
			records,
		};

		visit(walk, node, [name]);
	}

	return records;
}

function visit(walk: Walk, node: ErasedNode, path: string[]) {
	const fail = (reason: string) => new CommandDefinitionError(walk.owner, path.join(' '), reason);
	const name = path.at(-1) ?? '';

	if (!NAME.test(name) || name !== name.toLowerCase()) {
		throw fail('names are 1-32 lowercase letters, digits, - or _.');
	}

	if (typeof node !== 'object' || node === null) {
		throw fail('a command must be an object.');
	}

	assertKey(walk.locales, node.description, 'description', fail);

	const isGroup = node.subcommands !== undefined;

	if (isGroup === (typeof node.execute === 'function')) {
		throw fail('a command needs either `execute` or `subcommands`, not both.');
	}

	if (isGroup) {
		const children = Object.entries(node.subcommands ?? {});

		if (path.length >= MAX_DEPTH) {
			throw fail(`subcommands nest at most ${MAX_DEPTH} levels deep.`);
		}

		if (node.options !== undefined) {
			throw fail('a group cannot have options.');
		}

		if (children.length < 1 || children.length > MAX_ENTRIES) {
			throw fail(`a group needs 1 to ${MAX_ENTRIES} subcommands.`);
		}

		for (const [child, subnode] of children) {
			visit(walk, subnode, [...path, child]);
		}

		return;
	}

	const declared = Object.entries(node.options ?? {});

	if (declared.length > MAX_ENTRIES) {
		throw fail(`a command has at most ${MAX_ENTRIES} options.`);
	}

	const options = declared.map(([option, spec]) =>
		normalizeOption(walk.locales, option, spec, fail),
	);
	const id =
		path.length === 1 ? walk.rootId : [walk.rootId, ...path.slice(1)].join(walk.separator);

	walk.records.push(
		Object.freeze({
			id,
			rootId: walk.rootId,
			rootDescription: walk.rootDescription,
			owner: walk.owner,
			section: walk.section,
			locales: walk.locales,
			path: Object.freeze([...path]),
			description: node.description,
			// Discord rejects a required option after an optional one.
			options: Object.freeze([
				...options.filter((option) => option.required),
				...options.filter((option) => !option.required),
			]),
			execute: node.execute as ErasedExecute,
		}),
	);
}

function normalizeOption(
	locales: CommandLocales,
	name: string,
	spec: OptionSpec,
	fail: (reason: string) => CommandDefinitionError,
): NormalizedOption {
	const kind = getKind(spec?.kind);

	if (!kind) {
		throw fail(`option "${name}" was not made by an \`option\` builder.`);
	}

	if (!NAME.test(name) || name !== name.toLowerCase()) {
		throw fail(`option "${name}": names are 1-32 lowercase letters, digits, - or _.`);
	}

	const { description } = spec;
	const autocomplete = 'autocomplete' in spec.settings ? spec.settings.autocomplete : undefined;

	if (description !== undefined) {
		assertKey(locales, description, `option "${name}" description`, fail);
	}

	if (autocomplete !== undefined && typeof autocomplete !== 'function') {
		throw fail(`option "${name}": autocomplete must be a function.`);
	}

	return Object.freeze({
		name,
		description,
		kind: spec.kind,
		type: kind.type,
		required: spec.required,
		choices: spec.choices && normalizeChoices(locales, name, spec.choices, fail),
		extras: kind.toDiscord(spec.settings),
		autocomplete,
	});
}

function normalizeChoices(
	locales: CommandLocales,
	name: string,
	map: Readonly<Record<string, string>>,
	fail: (reason: string) => CommandDefinitionError,
): readonly NormalizedChoice[] {
	if (typeof map !== 'object' || map === null || Array.isArray(map)) {
		throw fail(`option "${name}" choices must map each value to a message key.`);
	}

	const choices = Object.entries(map).map(([value, label]) => Object.freeze({ label, value }));

	if (choices.length < 1 || choices.length > MAX_ENTRIES) {
		throw fail(`option "${name}" needs 1 to ${MAX_ENTRIES} choices.`);
	}

	for (const choice of choices) {
		assertKey(locales, choice.label, `option "${name}" choice "${choice.value}" label`, fail);

		if (!choice.value.trim() || choice.value.length > MAX_TEXT) {
			throw fail(`option "${name}" choice values must be 1-${MAX_TEXT} characters.`);
		}
	}

	// Discord maps a picked label back to the first choice with it, so a duplicate is unreachable.
	if (new Set(choices.map((choice) => locales.source(choice.label))).size !== choices.length) {
		throw fail(`option "${name}" has two choices with the same en-US label.`);
	}

	return Object.freeze(choices);
}

// Keys are checked on the owner's en-US table, which every other locale falls back to.
function assertKey(
	locales: CommandLocales,
	// UNKNOWN: an author's tree reaches here unchecked at runtime, so a key may be any value.
	key: unknown,
	what: string,
	fail: (reason: string) => CommandDefinitionError,
) {
	const text = typeof key === 'string' ? locales.source(key) : undefined;

	if (typeof key !== 'string' || text === undefined) {
		throw fail(
			`${what} ${JSON.stringify(key)} is not a key in ${SOURCE_FILE}. Use a key, and add it there.`,
		);
	}

	if (!text.trim() || text.length > MAX_TEXT) {
		throw fail(
			`${what} ${key} must be 1-${MAX_TEXT} characters in ${SOURCE_FILE}, not ${text.length}.`,
		);
	}
}

/**
 * @description Derives a root command's id from its owner and name: a negative integer string outside
 * Discord's built-in ids, so frecency treats it like a built-in.
 * @param owner The owner id.
 * @param root The root command name.
 * @returns The id.
 */
export function commandId(owner: string, root: string): string {
	return String(
		-(RESERVED_IDS + (cyrb53(`${owner}\0${root}`) % (Number.MAX_SAFE_INTEGER - RESERVED_IDS))),
	);
}

function cyrb53(text: string): number {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;

	for (let i = 0, len = text.length; i < len; i++) {
		const code = text.charCodeAt(i);

		h1 = Math.imul(h1 ^ code, 2654435761);
		h2 = Math.imul(h2 ^ code, 1597334677);
	}

	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
	h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
	h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

	return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
