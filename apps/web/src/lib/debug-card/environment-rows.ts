import type { DebugCardRequest } from '@unbound-app/contracts/debug-cards';

import { dim, joined, value, warn, type Span } from './spans';
import { shownMarkers } from './markers';

type DebugCardEnvironment = NonNullable<DebugCardRequest['environment']>;

const NOISE_BINARY_PARTS = /^(\d+ dylibs|\d+ injected|UUID \S+)$/;

function binaryText(binary: string): string {
	return binary
		.split(' · ')
		.filter((part) => !NOISE_BINARY_PARTS.test(part))
		.join(' · ');
}

function httpsSpans(https: NonNullable<DebugCardEnvironment['https']>): Span[] {
	if (https.intercepted) {
		return [warn(`MITM · ${https.issuer ?? 'unknown CA'}`)];
	}

	return https.failure
		? [dim(`unchecked · ${https.failure}`)]
		: [value('direct'), dim(https.issuer ? ` · ${https.issuer}` : '')];
}

/**
 * @description Lays out the loader's environment report: signer, binary, install, device markers and HTTPS.
 * @param environment The report, missing on older loaders.
 * @returns One row per fact the report has.
 */
export function environmentRows(environment?: DebugCardEnvironment): [string, Span[]][] {
	if (!environment) {
		return [];
	}

	const markers = shownMarkers(environment.markers ?? []);
	const candidates: [string, Span[]][] = [
		['signer', environment.signer ? [value(environment.signer)] : []],
		['binary', environment.binary ? [value(binaryText(environment.binary))] : []],
		['install', environment.install ? [value(environment.install)] : []],
		['markers', markers.length ? [dim(joined(markers))] : []],
		['https', environment.https ? httpsSpans(environment.https) : []],
	];

	return candidates.filter(([, spans]) => spans.length > 0);
}
