import nacl from 'tweetnacl';

const MAGIC = [0x55, 0x46, 0x58, 0x31];
const KEY_BYTES = nacl.secretbox.keyLength;
const NONCE_BYTES = nacl.secretbox.nonceLength;
const PUBLIC_BYTES = nacl.box.publicKeyLength;
const WRAPPED_BYTES = KEY_BYTES + nacl.box.overheadLength;
const ENTRY_BYTES = PUBLIC_BYTES + NONCE_BYTES + WRAPPED_BYTES;
const NAME_LIMIT = 255;

/** A key pair, as `nacl.box.keyPair` makes it. */
export type KeyPair = { publicKey: Uint8Array; secretKey: Uint8Array };

/** A decrypted file. */
export type Opened = { name: string; bytes: Uint8Array };

/**
 * @description Tells an encrypted file by its first bytes.
 * @param bytes The file.
 * @returns Whether it starts with this plugin's marker.
 */
export function isEnvelope(bytes: Uint8Array): boolean {
	return MAGIC.every((byte, index) => bytes[index] === byte);
}

function encodeName(name: string): Uint8Array {
	const encoded = new TextEncoder().encode(name);

	return encoded.byteLength > NAME_LIMIT ? encoded.subarray(0, NAME_LIMIT) : encoded;
}

function concat(parts: Uint8Array[]): Uint8Array {
	const out = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
	let offset = 0;

	for (const part of parts) {
		out.set(part, offset);
		offset += part.byteLength;
	}

	return out;
}

/**
 * @description Encrypts a file once with a random key, and wraps that key for each recipient with their public key,
 * so only they and the sender can open it. The file name travels inside the encrypted part.
 * @param bytes The file.
 * @param name The file's name.
 * @param sender The sender's key pair.
 * @param recipients The recipients' public keys; the sender's own key is added so they can open it too.
 * @returns The encrypted file.
 */
export function seal(
	bytes: Uint8Array,
	name: string,
	sender: KeyPair,
	recipients: Uint8Array[],
): Uint8Array {
	const contentKey = nacl.randomBytes(KEY_BYTES);
	const contentNonce = nacl.randomBytes(NONCE_BYTES);
	const nameBytes = encodeName(name);
	const plain = concat([new Uint8Array([nameBytes.byteLength]), nameBytes, bytes]);
	const keys = [
		sender.publicKey,
		...recipients.filter((key) => !nacl.verify(key, sender.publicKey)),
	];
	const entries = keys.map((publicKey) => {
		const nonce = nacl.randomBytes(NONCE_BYTES);

		return concat([publicKey, nonce, nacl.box(contentKey, nonce, publicKey, sender.secretKey)]);
	});

	return concat([
		new Uint8Array(MAGIC),
		sender.publicKey,
		new Uint8Array([keys.length]),
		...entries,
		contentNonce,
		nacl.secretbox(plain, contentNonce, contentKey),
	]);
}

/**
 * @description Opens an encrypted file with the reader's key pair.
 * @param envelope The encrypted file.
 * @param reader The reader's key pair.
 * @returns The file and its name, or `undefined` when it is not for this key or was changed.
 */
export function open(envelope: Uint8Array, reader: KeyPair): Opened | undefined {
	if (!isEnvelope(envelope)) return undefined;

	let offset = MAGIC.length;
	const senderKey = envelope.subarray(offset, (offset += PUBLIC_BYTES));
	const count = envelope[offset++] ?? 0;
	let contentKey: Uint8Array | null = null;

	for (let index = 0; index < count; index++) {
		const entry = envelope.subarray(offset, (offset += ENTRY_BYTES));

		if (contentKey || !nacl.verify(entry.subarray(0, PUBLIC_BYTES), reader.publicKey)) continue;

		const nonce = entry.subarray(PUBLIC_BYTES, PUBLIC_BYTES + NONCE_BYTES);

		contentKey = nacl.box.open(
			entry.subarray(PUBLIC_BYTES + NONCE_BYTES),
			nonce,
			senderKey,
			reader.secretKey,
		);
	}

	if (!contentKey) return undefined;

	const nonce = envelope.subarray(offset, offset + NONCE_BYTES);
	const plain = nacl.secretbox.open(envelope.subarray(offset + NONCE_BYTES), nonce, contentKey);

	if (!plain) return undefined;

	const nameLength = plain[0] ?? 0;

	return {
		name: new TextDecoder().decode(plain.subarray(1, 1 + nameLength)),
		bytes: plain.subarray(1 + nameLength),
	};
}
