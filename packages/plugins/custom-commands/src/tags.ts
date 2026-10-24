import { ARGUMENT_PATTERN, MAX_ATTACHMENTS, MAX_DESCRIPTION_LENGTH } from '~/constants';

export type TagMedia = {
	fileName: string;
	fileSize: number;
	height?: number;
	mimeType: string;
	storedName: string;
	width?: number;
	duration?: number;
};

export type Tag = {
	name: string;
	description?: string;
	message: string;
	media: TagMedia[];
};

export type TagArgument = {
	name: string;
	defaultValue: string | null;
};

export type CommandOption = {
	name: string;
	value?: string | number | boolean;
	options?: CommandOption[];
};

type StoredTag = {
	name: string;
	message: string;
	description?: unknown;
	media?: unknown;
};

function parseArgument(body: string): TagArgument {
	const [name, ...defaultParts] = body.split('=');

	return {
		name: name.trim().toLowerCase(),
		defaultValue: defaultParts.length ? defaultParts.join('=').trim() : null,
	};
}

function isStoredTag(entry: unknown): entry is StoredTag {
	return (
		typeof entry === 'object' &&
		entry !== null &&
		'name' in entry &&
		typeof entry.name === 'string' &&
		'message' in entry &&
		typeof entry.message === 'string'
	);
}

function isStoredMedia(item: unknown): item is TagMedia {
	return (
		typeof item === 'object' &&
		item !== null &&
		'storedName' in item &&
		typeof item.storedName === 'string' &&
		/^custom-commands-[a-z0-9-]+\.[a-z0-9]+$/i.test(item.storedName) &&
		'fileName' in item &&
		typeof item.fileName === 'string' &&
		'mimeType' in item &&
		typeof item.mimeType === 'string'
	);
}

/**
 * @description Gets the text shown under a command in Discord's slash-command list.
 * @param tag The saved command.
 * @returns The tag's own description, or a generated one when it has none.
 */
export function getTagDescription(tag: Tag): string {
	return tag.description?.trim() || `Send the ${tag.name} command`;
}

/**
 * @description Finds the `{{name}}` and `{{name = default}}` placeholders in a response.
 * @param message The command's response template.
 * @returns Each argument once, lowercased, in order of first appearance.
 */
export function parseTagArguments(message: string): TagArgument[] {
	const argumentsByName = new Map<string, TagArgument>();

	for (const match of message.matchAll(ARGUMENT_PATTERN)) {
		const argument = parseArgument(match[1]);

		if (!argument.name || argumentsByName.has(argument.name)) {
			continue;
		}

		argumentsByName.set(argument.name, argument);
	}

	return [...argumentsByName.values()];
}

/**
 * @description Checks a command against the rules Discord and this plugin place on it.
 * @param tag The command to check.
 * @param existing The commands already saved.
 * @param originalName The name the command had before this edit, if it is being edited.
 * @param mediaCount How many attachments the command will have, including ones not yet saved.
 * @returns A message describing the first problem, or `null` when the command is valid.
 */
export function validateTag(
	tag: Tag,
	existing: Tag[],
	originalName?: string,
	mediaCount: number = tag.media.length,
): string | null {
	if (!/^[a-z0-9_-]{1,32}$/.test(tag.name)) {
		return 'Use 1–32 lowercase letters, numbers, hyphens, or underscores for the command name.';
	}

	if (tag.description && tag.description.trim().length > MAX_DESCRIPTION_LENGTH) {
		return `Use at most ${MAX_DESCRIPTION_LENGTH} characters for the command description.`;
	}

	if (!tag.message.trim() && !mediaCount) {
		return 'Add a response or at least one image or video.';
	}

	if (parseTagArguments(tag.message).some((argument) => argument.name === 'ephemeral')) {
		return 'The argument name “ephemeral” is reserved.';
	}

	if (mediaCount > MAX_ATTACHMENTS) {
		return `A command can have at most ${MAX_ATTACHMENTS} attachments.`;
	}

	if (existing.some((entry) => entry.name === tag.name && entry.name !== originalName)) {
		return 'A command with this name already exists.';
	}

	return null;
}

// UNKNOWN: the saved `tags` setting is user data read from disk and may be malformed.
/**
 * @description Parses the saved `tags` setting, dropping malformed, invalid, and duplicate entries.
 * @param value The raw setting value.
 * @returns The valid commands; the first command with a given name wins.
 */
export function normalizeTags(value: unknown): Tag[] {
	if (!Array.isArray(value)) return [];

	const tags: Tag[] = [];
	const names = new Set<string>();

	for (const entry of value) {
		if (!isStoredTag(entry)) {
			continue;
		}

		const description =
			typeof entry.description === 'string' &&
			entry.description.trim().length <= MAX_DESCRIPTION_LENGTH
				? entry.description.trim()
				: '';

		const tag: Tag = {
			name: entry.name,
			message: entry.message,
			media: Array.isArray(entry.media) ? entry.media.filter(isStoredMedia) : [],
			...(description ? { description } : {}),
		};

		if (names.has(tag.name) || validateTag(tag, []) !== null) {
			continue;
		}

		names.add(tag.name);
		tags.push(tag);
	}

	return tags;
}

/**
 * @description Finds a command option by name, searching nested sub-command options too.
 * @param options The options Discord passed to the command.
 * @param name The option's name.
 * @returns The option's value, or `undefined` when it was not supplied.
 */
export function getOptionValue(
	options: CommandOption[],
	name: string,
): CommandOption['value'] | undefined {
	for (const option of options) {
		if (option.name === name) return option.value;

		const nested = option.options && getOptionValue(option.options, name);

		if (nested !== undefined) return nested;
	}

	return undefined;
}

/**
 * @description Fills a response template with the command's options and turns a typed `\n` into a line break.
 * @param message The command's response template.
 * @param options The options Discord passed to the command.
 * @returns The text to send. A placeholder with no value and no default is left as written.
 */
export function renderTagMessage(message: string, options: CommandOption[]): string {
	return message
		.replace(ARGUMENT_PATTERN, (placeholder, body: string) => {
			const { name, defaultValue } = parseArgument(body);
			const value = getOptionValue(options, name);

			if (value !== undefined && value !== null) {
				return String(value);
			}

			return defaultValue ?? placeholder;
		})
		.replaceAll('\\n', '\n');
}

export default {
	getTagDescription,
	parseTagArguments,
	validateTag,
	normalizeTags,
	getOptionValue,
	renderTagMessage,
};
