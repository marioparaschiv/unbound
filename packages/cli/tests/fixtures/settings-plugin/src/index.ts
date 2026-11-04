import { settings } from '@unbound-app/settings';

/**
 * @description Reads settings the way plugin code does.
 * @returns The accent when greeting, otherwise the style.
 */
function start(): string {
	return settings.greetOnStart ? settings.appearance.accent : settings.style;
}

export { start };
