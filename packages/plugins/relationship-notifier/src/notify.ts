import type { ToastHandle, ToastOptions } from '@unbound-app/api/toasts';
import { toasts } from '@unbound-app/api';

import { FALLBACK_ICON, PLUGIN_NAME } from '~/constants';
import { avatarURL, openProfile, type DiscordUser } from '~/discord';
import { readSettings } from '~/modules';

type ToastButton = NonNullable<ToastOptions['buttons']>[number];

let nextId = 0;

function buttons(handle: () => ToastHandle, persistent: boolean, userId?: string): ToastButton[] {
	const profile: ToastButton[] = userId
		? [
				{
					content: 'View Profile',
					variant: 'secondary',
					onPress: () => {
						handle().close();
						openProfile(userId);
					},
				},
			]
		: [];
	const dismiss: ToastButton[] = persistent
		? [{ content: 'OK', onPress: () => handle().close() }]
		: [];

	return [...profile, ...dismiss];
}

/**
 * @description Shows a notification as a toast; with **Persistent Notices** on, it stays until dismissed.
 * @param text The notification text.
 * @param iconURL The image to show, such as a server icon.
 * @param userId The user whose profile a button opens.
 */
export function notify(text: string, iconURL?: string, userId?: string): void {
	const persistent = readSettings().notices;
	const actions = buttons(() => handle, persistent, userId);
	const handle = toasts.show({
		id: `relationship-notifier-${nextId++}`,
		title: PLUGIN_NAME,
		content: text,
		icon: iconURL ? { uri: iconURL } : FALLBACK_ICON,
		tintedIcon: !iconURL,
		duration: persistent ? 0 : undefined,
		buttons: actions.length ? actions : undefined,
	});
}

/**
 * @description Notifies about a user, with their avatar and a button to their profile.
 * @param text The notification text.
 * @param user The user it is about.
 */
export function notifyAboutUser(text: string, user: DiscordUser): void {
	notify(text, avatarURL(user), user.id);
}
