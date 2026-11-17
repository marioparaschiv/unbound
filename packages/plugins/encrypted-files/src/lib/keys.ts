import { settings } from '@unbound-app/settings';
import nacl from 'tweetnacl';

import type { KeyPair } from '~/lib/envelope';
import { fromBase64, toBase64 } from '~/lib/key-text';

type Contacts = Record<string, string>;

function readContacts(): Contacts {
	try {
		const parsed: unknown = JSON.parse(settings.contacts || '{}');

		return typeof parsed === 'object' && parsed !== null ? (parsed as Contacts) : {};
	} catch {
		// A damaged contact list starts empty; people share their keys again.
		return {};
	}
}

/**
 * @description Reads this device's key pair, making one the first time.
 * @returns The key pair.
 */
export function ownKeys(): KeyPair {
	if (!settings.secretKey) {
		const pair = nacl.box.keyPair();

		settings.secretKey = toBase64(pair.secretKey);
		settings.publicKey = toBase64(pair.publicKey);
	}

	return { publicKey: fromBase64(settings.publicKey), secretKey: fromBase64(settings.secretKey) };
}

/**
 * @description Saves the public key someone shared, replacing any earlier one.
 * @param userId Whose key it is.
 * @param publicKey The key.
 */
export function saveContactKey(userId: string, publicKey: Uint8Array): void {
	settings.contacts = JSON.stringify({ ...readContacts(), [userId]: toBase64(publicKey) });
}

/**
 * @description Forgets someone's key.
 * @param userId Whose key to forget.
 */
export function forgetContact(userId: string): void {
	const { [userId]: _forgotten, ...rest } = readContacts();

	settings.contacts = JSON.stringify(rest);
}

/**
 * @description Reads a saved contact key.
 * @param userId Whose key.
 * @returns The key, or `undefined` when none is saved.
 */
export function contactKey(userId: string): Uint8Array | undefined {
	const text = readContacts()[userId];

	return text ? fromBase64(text) : undefined;
}

/**
 * @description Lists the users whose keys are saved.
 * @returns Their ids.
 */
export function contactIds(): string[] {
	return Object.keys(readContacts());
}

/**
 * @description Tells whether new files in a channel are encrypted.
 * @param channelId The channel.
 * @returns Whether encryption is on there.
 */
export function encryptsIn(channelId: string): boolean {
	return settings.channels.split(',').includes(channelId);
}

/**
 * @description Turns encryption of new files in a channel on or off.
 * @param channelId The channel.
 * @param on Whether to encrypt.
 */
export function setEncryptsIn(channelId: string, on: boolean): void {
	const others = settings.channels.split(',').filter((id: string) => id && id !== channelId);

	settings.channels = (on ? [...others, channelId] : others).join(',');
}
