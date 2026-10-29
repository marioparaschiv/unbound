import type { ToastOptions } from '@unbound-app/types/toasts';
import type { ComponentType } from 'react';

type DiscordToastField =
	| string
	| number
	| ComponentType
	| Record<string, string>
	| null
	| undefined;

export type DiscordToastOptions = Omit<ToastOptions, 'title' | 'content'> & {
	key?: string;
	content?: DiscordToastField;
	title?: DiscordToastField;
};

function visibleText(value: DiscordToastField): string | undefined {
	if (typeof value === 'number') {
		return String(value);
	}

	if (typeof value !== 'string' || !value.trim()) {
		return undefined;
	}

	return value;
}

function hasButtons(options: ToastOptions) {
	return Array.isArray(options.buttons) && options.buttons.length > 0;
}

/**
 * @description Whether a toast has a title, content or buttons to render.
 * @param options The toast options to check.
 * @returns True when the toast would render something besides its close button.
 */
export function hasVisibleContent(options: ToastOptions) {
	return (
		typeof options.title === 'function' ||
		Boolean(visibleText(options.title)) ||
		Boolean(visibleText(options.content)) ||
		hasButtons(options)
	);
}

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
