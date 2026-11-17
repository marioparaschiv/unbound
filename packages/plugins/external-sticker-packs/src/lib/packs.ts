import { storage } from '@unbound-app/api';

import { readPack, type Pack } from '~/lib/line';

const PACKS_KEY = 'packs';

function bucket() {
	return storage.getBucket(addon.id);
}

function asPack(value: unknown): Pack | undefined {
	if (!value || typeof value !== 'object') return undefined;

	const saved = value as Partial<Pack>;

	return readPack({
		packageId: Number(saved.id),
		title: { en: saved.title },
		stickers: (saved.stickers ?? []).map((sticker) => ({ ...sticker, id: Number(sticker.id) })),
	});
}

/**
 * @description Reads the saved packs, oldest first.
 * @returns The packs.
 */
export function savedPacks(): Pack[] {
	const saved = bucket().get<unknown[]>(PACKS_KEY, []);

	return (Array.isArray(saved) ? saved : []).flatMap((value) => asPack(value) ?? []);
}

/**
 * @description Saves a pack, replacing one with the same number.
 * @param pack The pack.
 */
export function savePack(pack: Pack): void {
	bucket().set(PACKS_KEY, [...savedPacks().filter(({ id }) => id !== pack.id), pack]);
}

/**
 * @description Removes a pack.
 * @param id The pack number.
 */
export function removePack(id: string): void {
	bucket().set(
		PACKS_KEY,
		savedPacks().filter((pack) => pack.id !== id),
	);
}
