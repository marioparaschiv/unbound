/** A saved custom status: its text and emoji, as Discord's custom status setting holds them. */
export type StatusPreset = { text: string; emojiId: string; emojiName: string };

type StoredStatus = { text?: unknown; emojiId?: unknown; emojiName?: unknown };

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/**
 * @description Reads a custom status as a preset.
 * @param status The status as Discord's setting or the stored presets hold it.
 * @returns The preset, or `undefined` for an empty status.
 */
export function toPreset(status: StoredStatus | null | undefined): StatusPreset | undefined {
	if (!status) return;

	const preset = {
		text: text(status.text).trim(),
		emojiId: text(status.emojiId) === '0' ? '' : text(status.emojiId),
		emojiName: text(status.emojiName),
	};

	return preset.text || preset.emojiName ? preset : undefined;
}

/**
 * @description Tells whether two presets set the same status.
 * @param a One preset.
 * @param b The other.
 * @returns Whether their text and emoji match.
 */
export function samePreset(a: StatusPreset, b: StatusPreset): boolean {
	return a.text === b.text && a.emojiId === b.emojiId && a.emojiName === b.emojiName;
}

/**
 * @description Reads the stored presets, skipping anything that is not one.
 * @param stored The setting's JSON.
 * @returns The presets.
 */
export function parsePresets(stored: string): StatusPreset[] {
	try {
		const list: unknown = JSON.parse(stored);

		return Array.isArray(list)
			? list.flatMap((item) => toPreset(item as StoredStatus) ?? [])
			: [];
	} catch {
		return [];
	}
}

/**
 * @description Adds a preset to the front of the list, unless the same status is saved already.
 * @param presets The saved presets.
 * @param preset The preset to add.
 * @returns The new list.
 */
export function addPreset(presets: StatusPreset[], preset: StatusPreset): StatusPreset[] {
	return presets.some((saved) => samePreset(saved, preset)) ? presets : [preset, ...presets];
}

/**
 * @description Removes a preset.
 * @param presets The saved presets.
 * @param preset The preset to remove.
 * @returns The new list.
 */
export function removePreset(presets: StatusPreset[], preset: StatusPreset): StatusPreset[] {
	return presets.filter((saved) => !samePreset(saved, preset));
}
