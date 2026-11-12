import { deflateRawSync, inflateRawSync } from 'node:zlib';

import type { PlistValue } from './plist';

/** The `/debug` report the card's alt text carries: flat fields, plus the entitlements plist as JSON. */
export type DebugAltPayload = Record<string, PlistValue>;

/** Marks packed alt text and its format; a new dictionary needs a new version, or old cards stop decoding. */
export const DEBUG_ALT_PREFIX = 'ubd1:';

const BITS = 15;
const MASK = (1 << BITS) - 1;

// 2^15 code points in three blocks that no Unicode normalisation touches, all in the BMP so each counts as one character.
const RANGES = [
	{ start: 0x4e_00, size: 20_992 },
	{ start: 0x34_00, size: 6592 },
	{ start: 0xac_00, size: 5184 },
] as const;

// Deflate's preset dictionary: text the payload usually repeats. The most common goes last, where matches cost fewest bits.
const DICTIONARY = Buffer.from(
	[
		'com.apple.developer.healthkit',
		'com.apple.developer.homekit',
		'com.apple.developer.game-center',
		'com.apple.developer.in-app-payments',
		'com.apple.developer.icloud-services',
		'com.apple.developer.icloud-container-identifiers',
		'com.apple.developer.icloud-container-development-container-identifiers',
		'com.apple.developer.ubiquity-kvstore-identifier',
		'com.apple.developer.ubiquity-container-identifiers',
		'com.apple.developer.networking.networkextension',
		'com.apple.developer.networking.wifi-info',
		'com.apple.developer.networking.multipath',
		'com.apple.developer.networking.HotspotConfiguration',
		'com.apple.developer.networking.vpn.api',
		'com.apple.developer.siri',
		'com.apple.developer.nfc.readersession.formats',
		'com.apple.developer.pass-type-identifiers',
		'com.apple.developer.ClassKit-environment',
		'com.apple.developer.applesignin',
		'com.apple.developer.authentication-services.autofill-credential-provider',
		'com.apple.developer.coremedia.hls.low-latency',
		'com.apple.developer.kernel.extended-virtual-addressing',
		'com.apple.developer.kernel.increased-debugging-memory-limit',
		'com.apple.developer.devicecheck.appattest-environment',
		'com.apple.developer.avfoundation.multitasking-camera-access',
		'com.apple.developer.usernotifications.communication',
		'com.apple.developer.usernotifications.time-sensitive',
		'com.apple.developer.associated-domains',
		'com.apple.developer.default-data-protection',
		'NSFileProtectionComplete',
		'com.apple.developer.kernel.increased-memory-limit',
		'com.apple.security.application-groups',
		'com.hammerandchisel.discord',
		'group.com.rileytestut.AltStore',
		'group.com.SideStore.SideStore',
		'com.kdt.livecontainer',
		'com.apple.token',
		'keychain-access-groups',
		'get-task-allow',
		'"development","production"',
		'"aps-environment":"production"',
		'com.apple.developer.team-identifier',
		'"application-identifier":"',
		'"entitlements":{',
		'"native":"',
		' hooks · ',
		' surfaces · ',
		' handles',
		'"patches":["unbound::',
		'"heap":"',
		' MB · gc ',
		' ms"',
		'"plugins":"',
		'"themes":"',
		'"iconPack":"default"',
		'"locale":"en-US"',
		'"support":"supported"',
		'"state":["Jailed","verified build"]',
		'"bytecode":"98"',
		'"hermes":"250829098.0.15"',
		'"reactNative":"0.86.0"',
		'"react":"19.2.3"',
		'"os":"',
		'"platform":"iOS"',
		'"device":"iPhone ',
		'"install":"Development (',
		'"install":"Ad Hoc (',
		'"install":"Unprovisioned (',
		' · expires ',
		'"source":"Sideloaded (TestFlight build)"',
		'"source":"Sideloaded (App Store build)"',
		'"build":"',
		'"channel":"stable"',
		'"channel":"beta"',
		'"discord":"',
		'"jailbreak":""',
		'"framework":"ElleKit ',
		'"loaderOrigin":"Unbound.dylib"',
		'"loader":"1.3.0"',
		'"commit":"',
		'{"unbound":"',
	].join(''),
);

function toChar(value: number): string {
	let offset = value;

	for (const { start, size } of RANGES) {
		if (offset < size) {
			return String.fromCharCode(start + offset);
		}

		offset -= size;
	}

	throw new RangeError(`${value} does not fit in ${BITS} bits.`);
}

function fromChar(code: number): number | undefined {
	let offset = 0;

	for (const { start, size } of RANGES) {
		if (code >= start && code < start + size) {
			return offset + code - start;
		}

		offset += size;
	}

	return undefined;
}

/**
 * @description Packs the `/debug` report into alt text: JSON, deflated against a preset dictionary, 15 bits per character.
 * @param payload The report.
 * @returns The prefixed text; usually a quarter of the JSON's length or less.
 */
export function packDebugAltText(payload: DebugAltPayload): string {
	const bytes = deflateRawSync(JSON.stringify(payload), { level: 9, dictionary: DICTIONARY });
	let text = DEBUG_ALT_PREFIX;
	let bits = 0;
	let held = 0;

	for (const byte of bytes) {
		bits = (bits << 8) | byte;
		held += 8;

		while (held >= BITS) {
			held -= BITS;
			text += toChar((bits >> held) & MASK);
		}

		bits &= (1 << held) - 1;
	}

	// Zero padding can decode as one extra trailing byte, which inflate ignores after the final block.
	return held ? text + toChar((bits << (BITS - held)) & MASK) : text;
}

/**
 * @description Unpacks alt text `packDebugAltText` wrote.
 * @param text An image's alt text.
 * @returns The report's JSON text for the caller to parse, or `undefined` when the text is not a packed report.
 */
export function unpackDebugAltText(text: string): string | undefined {
	if (!text.startsWith(DEBUG_ALT_PREFIX)) {
		return undefined;
	}

	const bytes: number[] = [];
	let bits = 0;
	let held = 0;

	for (let index = DEBUG_ALT_PREFIX.length; index < text.length; index++) {
		const value = fromChar(text.charCodeAt(index));

		if (value === undefined) {
			return undefined;
		}

		bits = (bits << BITS) | value;
		held += BITS;

		while (held >= 8) {
			held -= 8;
			bytes.push((bits >> held) & 0xff);
		}

		bits &= (1 << held) - 1;
	}

	try {
		return inflateRawSync(Buffer.from(bytes), { dictionary: DICTIONARY }).toString();
	} catch {
		// Damaged or cut text: the caller treats the image as carrying no report.
		return undefined;
	}
}

export default { DEBUG_ALT_PREFIX, packDebugAltText, unpackDebugAltText };
