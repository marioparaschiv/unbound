import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import { describe, expect, test } from 'bun:test';

import { discordFailure, eventNonce } from '~/lib/discord-messages';

function apiError(code: number, status: number) {
	return new DiscordAPIError({ code, message: 'x' }, code, status, 'GET', '/x', {});
}

describe('discordFailure', () => {
	test('names each failure a caller acts on', () => {
		expect(discordFailure(apiError(RESTJSONErrorCodes.UnknownMessage, 404))).toBe('gone');
		expect(discordFailure(apiError(RESTJSONErrorCodes.UnknownMember, 404))).toBe('gone');
		expect(discordFailure(apiError(RESTJSONErrorCodes.UnknownUser, 404))).toBe('undeliverable');
		expect(discordFailure(apiError(RESTJSONErrorCodes.CannotSendMessagesToThisUser, 403))).toBe(
			'undeliverable',
		);
		expect(discordFailure(apiError(RESTJSONErrorCodes.MissingPermissions, 403))).toBe(
			'forbidden',
		);
		expect(discordFailure(apiError(RESTJSONErrorCodes.InvalidFormBodyOrContentType, 400))).toBe(
			'rejected',
		);
	});

	test('leaves a failure a retry may fix, and any other error, unnamed', () => {
		expect(discordFailure(apiError(0, 500))).toBeUndefined();
		expect(discordFailure(new Error('socket hang up'))).toBeUndefined();
	});
});

describe('eventNonce', () => {
	test("ties a post to its event and the event's creation time, within Discord's 25 characters", () => {
		const createdAt = new Date('2026-10-26T00:16:49.591Z');
		const nonce = eventNonce('a', 2_147_483_647, createdAt);

		expect(nonce).toBe(`a2147483647.${createdAt.getTime().toString(36)}`);
		expect(nonce.length).toBeLessThanOrEqual(25);
		expect(eventNonce('a', 1, createdAt)).not.toBe(eventNonce('r', 1, createdAt));
	});
});
