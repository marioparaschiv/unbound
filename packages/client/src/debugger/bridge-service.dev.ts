import { BRIDGE_SERVICE_PROTOCOL, type BridgeAdvertisement } from '@unbound-app/debugger-protocol';

/** A bridge found on the local network: the computer it runs on, where to dial it, and its pairing code. */
export type DiscoveredBridge = {
	/** The service instance name, which the bridge sets to its computer's name. */
	computer: string;
	/** `host:port`, ready for `ws://`. */
	address: string;
	by: BridgeAdvertisement['by'];
	code: string;
};

const AF_INET = 2;
const PAIRING_CODE = /^\d{4}$/;

/**
 * @description Reads a DNS-SD TXT record: length-prefixed `key=value` strings, read as ASCII since a bridge writes no other.
 * @param bytes The record's raw bytes.
 * @returns Each key with its value; a key without `=` maps to `''`.
 */
export function readTxtRecord(bytes: Uint8Array): Record<string, string> {
	const entries: Record<string, string> = {};

	for (let offset = 0; offset < bytes.length;) {
		const length = bytes[offset] ?? 0;
		const entry = String.fromCharCode(...bytes.subarray(offset + 1, offset + 1 + length));
		const split = entry.indexOf('=');

		offset += 1 + length;

		if (!entry || split === 0) {
			continue;
		}

		if (split === -1) {
			entries[entry] = '';
		} else {
			entries[entry.slice(0, split)] = entry.slice(split + 1);
		}
	}

	return entries;
}

/**
 * @description Reads an IPv4 `sockaddr_in`, as `NSNetService.addresses` holds them.
 * @param bytes The socket address's raw bytes.
 * @returns `host:port`, or `undefined` for any other address family.
 */
export function readSocketAddress(bytes: Uint8Array): string | undefined {
	if (bytes.length < 8 || bytes[1] !== AF_INET) return;

	const port = ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0);

	return `${bytes.subarray(4, 8).join('.')}:${port}`;
}

/**
 * @description Picks the address to dial from a service's resolved addresses, preferring a routable one over a
 * link-local `169.254.x.x` address, which only some networks carry.
 * @param addresses The `host:port` addresses, `undefined` for ones that were not IPv4.
 * @returns The address to dial, or `undefined` when none is IPv4.
 */
export function pickAddress(addresses: (string | undefined)[]): string | undefined {
	const ipv4 = addresses.filter((address): address is string => Boolean(address));

	return ipv4.find((address) => !address.startsWith('169.254.')) ?? ipv4[0];
}

/**
 * @description Builds a discovered bridge from a resolved service, if it advertises this protocol.
 * @param computer The service instance name.
 * @param address The address the service resolved to.
 * @param txt The service's TXT record.
 * @returns The bridge, or `undefined` when the record is from another protocol or lacks a pairing code.
 */
export function toDiscoveredBridge(
	computer: string,
	address: string,
	txt: Record<string, string>,
): DiscoveredBridge | undefined {
	const { proto, by, code } = txt;

	if (proto !== BRIDGE_SERVICE_PROTOCOL || !code || !PAIRING_CODE.test(code)) return;

	return { computer, address, by: by === 'cli' ? 'cli' : 'devtools', code };
}
