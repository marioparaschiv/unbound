import type { ToastOptions } from '@unbound-app/types/toasts';
import type { ComponentType } from 'react';

export type ToastField =
	| string
	| number
	| ComponentType
	| Record<string, string>
	| null
	| undefined;

/**
 * @description Reads a toast field as text, treating blank strings as absent.
 * @param value The field to read.
 * @returns The text to render, or undefined when the field has none.
 */
export function visibleText(value: ToastField): string | undefined {
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
export function hasVisibleContent(options: ToastOptions): boolean {
	return (
		typeof options.title === 'function' ||
		Boolean(visibleText(options.title)) ||
		Boolean(visibleText(options.content)) ||
		hasButtons(options)
	);
}

export default { visibleText, hasVisibleContent };
