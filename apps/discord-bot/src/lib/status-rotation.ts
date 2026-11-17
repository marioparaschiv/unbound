import type { PublicAddon } from '@unbound-app/web/bot';
import { ActivityType, type Client } from 'discord.js';
import { createLogger } from '@unbound-app/logger';

const logger = createLogger('Bot', 'Status');

const ROTATE_MS = 60_000;
const REFRESH_MS = 10 * 60_000;

/** What the bot's status cycles through. */
export type StatusStats = {
	plugins: number;
	themes: number;
	iconPacks: number;
	members?: number;
};

type StatusOptions = {
	client: Client<true>;
	guildId: string;
	addons: () => Promise<PublicAddon[]>;
};

function plural(count: number, one: string, many: string): string {
	return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
}

/**
 * @description Counts the listed addons by kind.
 * @param addons Every addon that serves a version.
 * @returns The counts, delisted addons left out.
 */
export function addonStats(addons: PublicAddon[]): Omit<StatusStats, 'members'> {
	const listed = addons.filter((addon) => addon.listed);
	const count = (type: PublicAddon['type']) =>
		listed.filter((addon) => addon.type === type).length;

	return { plugins: count('plugin'), themes: count('theme'), iconPacks: count('icon-pack') };
}

/**
 * @description Writes the lines the bot's custom status rotates through.
 * @param stats The current counts.
 * @returns The lines, in order.
 */
export function statusLines({ plugins, themes, iconPacks, members }: StatusStats): string[] {
	return [
		`${plural(plugins, 'plugin', 'plugins')} on unbound.rip`,
		`${plural(themes, 'theme', 'themes')} and ${plural(iconPacks, 'icon pack', 'icon packs')}`,
		...(members === undefined ? [] : [`Helping ${plural(members, 'member', 'members')}`]),
		'Type /debug for help',
	];
}

/**
 * @description Cycles the bot's custom status through live stats: the listed addons, read every ten minutes, and the
 * server's member count, changing every minute. A failed read keeps the last counts.
 * @param options The client, the guild whose members are counted, and the addon read.
 * @returns A function that stops the rotation.
 */
export function startStatusRotation({ client, guildId, addons }: StatusOptions): () => void {
	let stats: StatusStats | undefined;
	let index = 0;

	async function refresh() {
		try {
			stats = {
				...addonStats(await addons()),
				members: client.guilds.cache.get(guildId)?.memberCount,
			};
		} catch (error) {
			logger.warn('Failed to read the addon counts for the status:', error);
		}
	}

	function rotate() {
		if (!stats) return;

		const lines = statusLines(stats);
		const state = lines[index++ % lines.length]!;

		client.user.setPresence({
			status: 'dnd',
			activities: [{ type: ActivityType.Custom, name: 'Custom Status', state }],
		});
	}

	void refresh().then(rotate);

	const refreshing = setInterval(() => void refresh(), REFRESH_MS);
	const rotating = setInterval(rotate, ROTATE_MS);

	return () => {
		clearInterval(refreshing);
		clearInterval(rotating);
	};
}

export default startStatusRotation;
