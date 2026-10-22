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
	value?: unknown;
	options?: CommandOption[];
};

const ARGUMENT_PATTERN = /{{(.+?)}}/g;
const COMMAND_NAME_PATTERN = /^[a-z0-9_-]{1,32}$/;

export function getTagDescription(tag: Tag): string {
	return tag.description?.trim() || `Send the ${tag.name} command`;
}

export function parseTagArguments(message: string): TagArgument[] {
	const argumentsByName = new Map<string, TagArgument>();

	for (const match of message.matchAll(ARGUMENT_PATTERN)) {
		const [rawName, ...defaultParts] = match[1].split('=');
		const name = rawName.trim().toLowerCase();
		if (!name || argumentsByName.has(name)) continue;

		argumentsByName.set(name, {
			name,
			defaultValue: defaultParts.length ? defaultParts.join('=').trim() : null,
		});
	}

	return [...argumentsByName.values()];
}

export function validateTag(
	tag: Tag,
	existing: Tag[],
	originalName?: string,
	mediaCount: number = tag.media.length,
): string | null {
	if (!COMMAND_NAME_PATTERN.test(tag.name))
		return 'Use 1–32 lowercase letters, numbers, hyphens, or underscores for the command name.';
	if (tag.description && tag.description.trim().length > 100)
		return 'Use at most 100 characters for the command description.';
	if (!tag.message.trim() && !mediaCount) return 'Add a response or at least one image or video.';
	if (parseTagArguments(tag.message).some((argument) => argument.name === 'ephemeral'))
		return 'The argument name “ephemeral” is reserved.';
	if (mediaCount > 10) return 'A command can have at most 10 attachments.';
	if (existing.some((entry) => entry.name === tag.name && entry.name !== originalName))
		return 'A command with this name already exists.';
	return null;
}

export function normalizeTags(value: unknown): Tag[] {
	if (!Array.isArray(value)) return [];
	const tags: Tag[] = [];
	const names = new Set<string>();

	for (const entry of value) {
		if (!entry || typeof entry !== 'object') continue;
		const record = entry as Record<string, unknown>;
		if (typeof record.name !== 'string' || typeof record.message !== 'string') continue;
		const media = Array.isArray(record.media)
			? record.media.filter(
					(item): item is TagMedia =>
						item &&
						typeof item === 'object' &&
						typeof item.storedName === 'string' &&
						typeof item.fileName === 'string' &&
						typeof item.mimeType === 'string' &&
						/^custom-commands-[a-z0-9-]+\.[a-z0-9]+$/i.test(item.storedName),
				)
			: [];
		const description =
			typeof record.description === 'string' && record.description.trim().length <= 100
				? record.description.trim()
				: '';
		const tag = {
			name: record.name,
			message: record.message,
			media,
			...(description ? { description } : {}),
		};
		if (names.has(tag.name) || validateTag(tag, []) !== null) continue;
		names.add(tag.name);
		tags.push(tag);
	}

	return tags;
}

export function getOptionValue(
	options: CommandOption[] | Record<string, unknown>,
	name: string,
): unknown {
	if (Array.isArray(options)) {
		for (const option of options) {
			if (option.name === name) return option.value;
			if (option.options) {
				const nested = getOptionValue(option.options, name);
				if (nested !== undefined) return nested;
			}
		}
		return undefined;
	}

	return options[name];
}

export function renderTagMessage(
	message: string,
	options: CommandOption[] | Record<string, unknown>,
): string {
	return message
		.replace(ARGUMENT_PATTERN, (fullMatch, value: string) => {
			const [rawName, ...defaultParts] = value.split('=');
			const name = rawName.trim().toLowerCase();
			const option = getOptionValue(options, name);
			if (option !== undefined && option !== null) return String(option);
			return defaultParts.length ? defaultParts.join('=').trim() : fullMatch;
		})
		.replaceAll('\\n', '\n');
}
