import type { ToastHandle } from '@unbound-app/api/toasts';
import { settings } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { toasts } from '@unbound-app/api';

const CDN_URL = 'https://cdn.discordapp.com';
const FALLBACK_ICON = 'ShieldUserIcon';

let nextId = 0;

/**
 * @description Builds a server icon's URL.
 * @param guildId The server's id.
 * @param icon The server's icon hash.
 * @returns The URL, or `undefined` for a server without an icon.
 */
export function guildIconURL(guildId: string, icon: string | null | undefined): string | undefined {
	return icon ? `${CDN_URL}/icons/${guildId}/${icon}.png` : undefined;
}

/**
 * @description Shows a role change as a toast with the server's icon; with **Persistent notices** on, it stays until dismissed.
 * @param text The notification text.
 * @param iconURL The server's icon.
 */
export function notify(text: string, iconURL: string | undefined): void {
	const persistent = settings.notices;
	const handle: ToastHandle = toasts.show({
		id: `role-change-alerts-${nextId++}`,
		title: addon.name,
		content: text,
		icon: iconURL ? { uri: iconURL } : FALLBACK_ICON,
		tintedIcon: !iconURL,
		duration: persistent ? 0 : undefined,
		buttons: persistent ? [{ content: messages.OK, onPress: () => handle.close() }] : undefined,
	});
}
