import { metro, patcher } from '@unbound-app/api';
import type { MetroFunction } from '@unbound-app/api/metro';
import { settings } from '@unbound-app/settings';

import { userArgb } from '~/lib/colors';

type ChatRowMessage = {
	authorId?: string;
	guildId?: string;
	roleColor?: number | null;
	roleColors?: unknown;
	usernameColor?: number;
	colorString?: number;
};

type ChatRow = { message?: ChatRowMessage };

type NameColors = Pick<
	ChatRowMessage,
	'roleColor' | 'roleColors' | 'usernameColor' | 'colorString'
>;

type Applied = { original: NameColors; argb: number };

const cache = new Map<string, number>();

const colorsBeforeIrc = new WeakMap<ChatRowMessage, Applied>();

function cachedArgb(userId: string): number {
	const key = `${userId}:${settings.seed}:${settings.lightness}:${settings.saturation}`;
	const cached = cache.get(key);

	if (cached !== undefined) return cached;

	const argb = userArgb(userId, settings);

	cache.set(key, argb);

	return argb;
}

function originalColors(message: ChatRowMessage): NameColors {
	const previous = colorsBeforeIrc.get(message);

	if (previous && previous.argb === message.roleColor) return previous.original;

	const { roleColor, roleColors, usernameColor, colorString } = message;

	return { roleColor, roleColors, usernameColor, colorString };
}

function shouldColor(message: ChatRowMessage, original: NameColors): boolean {
	if (settings.onlyInDms && message.guildId) return false;

	return !settings.onlyWithoutColor || original.roleColor == null;
}

function colorRow(row: ChatRow | undefined): void {
	const message = row?.message;

	if (!message?.authorId) return;

	const original = originalColors(message);

	if (!shouldColor(message, original)) {
		Object.assign(message, original);
		colorsBeforeIrc.delete(message);

		return;
	}

	const argb = cachedArgb(message.authorId);

	Object.assign(message, {
		roleColor: argb,
		roleColors: null,
		usernameColor: argb,
		colorString: argb,
	});
	colorsBeforeIrc.set(message, { original, argb });
}

/**
 * @description Gives every author in chat their own name color, by patching `RowManager.prototype.generate` once it loads.
 */
export function patchRowManager(): void {
	metro.onModuleLoaded(metro.filters.byName('RowManager'), (RowManager: MetroFunction) => {
		if (typeof RowManager.prototype?.generate !== 'function') {
			logger.warn('IRC colors skipped: Discord moved RowManager.prototype.generate.');

			return;
		}

		patcher.after(RowManager.prototype, 'generate', ({ result }) => colorRow(result));
	});
}
