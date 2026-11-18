import { describe, expect, test } from 'bun:test';

import { asksForToken, createTokenGuard, isTokenStore } from '~/addons/token-gate';

const store = {
	secret: 'token',
	getToken() {
		return this.secret;
	},
	getId() {
		return this.secret.length;
	},
};

describe('token gate', () => {
	test('recognises lookups of the token module', () => {
		expect(asksForToken(['getToken'])).toBe(true);
		expect(asksForToken(['getToken', 'getId'])).toBe(true);
		expect(asksForToken(['getUser'])).toBe(false);
		expect(isTokenStore('AuthenticationStore')).toBe(true);
		expect(isTokenStore('Authentication')).toBe(true);
		expect(isTokenStore('UserStore')).toBe(false);
	});

	test('hides the token from a plugin without the permission and keeps everything else', () => {
		const guarded = createTokenGuard('Plugin', undefined)(store);

		expect(guarded.getToken()).toBeUndefined();
		expect(guarded.getId()).toBe(5);
	});

	test('hands the module over as it is with the permission', () => {
		expect(createTokenGuard('Plugin', ['account-token'])(store)).toBe(store);
	});
});
