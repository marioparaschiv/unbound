import type { ToastOptions } from '@unbound-app/types/toasts';

import { hasVisibleContent, visibleText, type ToastField } from '~/lib/toast-content';

export type DiscordToastOptions = Omit<ToastOptions, 'title' | 'content'> & {
	key?: string;
	content?: ToastField;
	title?: ToastField;
};

function discordToastOptions(options: DiscordToastOptions): ToastOptions | null {
	const { key, title, content, ...rest } = options;
	const heading = typeof title === 'function' ? title : visibleText(title);
	const body = visibleText(content);
	const mapped: ToastOptions = {
		...rest,
		title: heading ?? body,
		content: heading ? body : undefined,
		tintedIcon: false,
		duration: rest.duration ?? 5000,
	};

	if (rest.id === undefined && key) {
		mapped.id = `discord:${key}`;
	}

	return hasVisibleContent(mapped) ? mapped : null;
}

export default discordToastOptions;
