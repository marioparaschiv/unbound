import type { createLogger } from '@unbound-app/logger';

type Reinstaller = {
	getAddons(): { id: string }[];
	getSources(): Record<string, string>;
	install(url: string): Promise<{ id: string } | undefined>;
};

/**
 * @description Lists the addons installed from a URL whose files the loader did not load, because they were deleted or damaged.
 * @param sources Each installed addon's install URL, by id.
 * @param loaded The ids of the addons that loaded.
 * @returns Each missing addon's id and install URL.
 */
export function missingSources(
	sources: Record<string, string>,
	loaded: ReadonlySet<string>,
): [id: string, url: string][] {
	return Object.entries(sources).filter(([id, url]) => Boolean(url) && !loaded.has(id));
}

/**
 * @description Reinstalls the addons installed from a URL whose files did not load.
 * @param manager The addon manager.
 * @param logger The manager's logger.
 * @returns A promise that settles once every reinstall finished or failed.
 */
export async function repairMissingAddons(
	manager: Reinstaller,
	logger: ReturnType<typeof createLogger>,
): Promise<void> {
	const loaded = new Set(manager.getAddons().map((addon) => addon.id));

	for (const [id, url] of missingSources(manager.getSources(), loaded)) {
		logger.warn(`Reinstalling ${id}: its files were missing or damaged.`);

		try {
			await manager.install(url);
		} catch (error) {
			logger.error(`Failed to reinstall ${id}:`, error);
		}
	}
}

export default { missingSources, repairMissingAddons };
