import { isSaved, persistMedia, removeStoredMedia } from '~/media';
import type { Tag, TagMedia } from '~/tags';
import type { DraftMedia } from '~/media';
import { normalizeTags } from '~/tags';
import { settings } from '~/modules';

/** A command's text fields, as entered in the form. */
export type TagFields = Omit<Tag, 'media'>;

/**
 * @description Reads the saved commands.
 * @returns The valid saved commands.
 */
export function getTags(): Tag[] {
	return normalizeTags(settings.get('tags', []));
}

/**
 * @description Saves a new or edited command, copying newly picked attachments and deleting the files of removed ones.
 * @param fields The command's name, description, and response.
 * @param media The command's attachments, saved or newly picked.
 * @param original The command as it was before this edit, or `null` for a new command.
 * @returns A promise that settles once the command is saved. On failure, newly copied files are deleted.
 */
export async function saveTag(
	{ name, description, message }: TagFields,
	media: DraftMedia[],
	original: Tag | null,
): Promise<void> {
	const added: TagMedia[] = [];

	try {
		for (const item of media) {
			if (isSaved(item)) {
				continue;
			}

			added.push(await persistMedia(item));
		}

		const tag: Tag = {
			name,
			...(description ? { description } : {}),
			message,
			media: [...media.filter(isSaved), ...added],
		};

		settings.set('tags', [...getTags().filter((entry) => entry.name !== original?.name), tag]);

		const retained = new Set(tag.media.map((item) => item.storedName));

		for (const item of original?.media ?? []) {
			if (!retained.has(item.storedName)) await removeStoredMedia(item);
		}
	} catch (error) {
		await Promise.allSettled(added.map(removeStoredMedia));

		throw error;
	}
}

/**
 * @description Deletes a command and, in the background, its attachment files.
 * @param tag The command to delete.
 */
export function deleteTag(tag: Tag): void {
	settings.set(
		'tags',
		getTags().filter((entry) => entry.name !== tag.name),
	);

	void Promise.allSettled(tag.media.map(removeStoredMedia));
}

export default { getTags, saveTag, deleteTag };
