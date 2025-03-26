import { createLogger } from '@structures/logger';
import CoreStrings from '@i18n';


export type * from '@typings/api/i18n';

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
} catch (e) {
	Logger.error('Failed to initialize i18n:', e.message);
}

export const Strings = new Proxy({}, {
	get(_, prop) {
		return CoreStrings[state.locale]?.[prop] || 'MISSING_STRING';
	}
});
