import type { DebugCardRequest } from '@unbound-app/contracts/debug-cards';

import { dim, joined, value, warn, type Span } from './spans';

type DebugCardEnvironment = NonNullable<DebugCardRequest['environment']>;

function httpsSpans(https: NonNullable<DebugCardEnvironment['https']>): Span[] {
	if (https.intercepted) {
		return [warn(`intercepted by ${https.issuer ?? 'an unknown CA'}`)];
	}

	return https.failure
		? [dim(`not checked: ${https.failure}`)]
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

	const candidates: [string, Span[]][] = [
		['signer', environment.signer ? [value(environment.signer)] : []],
		['binary', environment.binary ? [value(environment.binary)] : []],
		['install', environment.install ? [value(environment.install)] : []],
		['markers', environment.markers?.length ? [dim(joined(environment.markers))] : []],
		['https', environment.https ? httpsSpans(environment.https) : []],
	];

	return candidates.filter(([, spans]) => spans.length > 0);
}
