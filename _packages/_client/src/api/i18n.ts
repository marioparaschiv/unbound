import { createLogger } from '~/structures/logger';
import CoreStrings from '@unbound-app/i18n';


const Logger = createLogger('API', 'i18n');

export const state = {
	locale: 'en-US',
	messages: {},
};

// @TODO: Implement
function initialize() {
	state.locale = 'en-US';

	// Backwards compat, pre-i18n switch
	// @ts-expect-error - @TODO Implement formatting when implementing new i18n
	String.prototype.format = function () {
		return this.toString();
	};
}

try {
	initialize();
} catch (error) {
	Logger.error('Failed to initialize i18n:', error instanceof Error ? error.message : String(error));
}

export const Strings: Record<string, any> = new Proxy({}, {
	get(_, prop) {
		return CoreStrings[state.locale]?.[prop] || 'MISSING_STRING';
	}
});
