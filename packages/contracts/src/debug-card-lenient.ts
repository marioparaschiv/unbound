import type { SchemaIssue } from './schema-error';

import { debugCardRequestSchema, type DebugCardRequest } from './debug-cards';
import { safeParse } from './schema';

const REQUIRED = new Set<string>(debugCardRequestSchema.required ?? []);
const MAX_PASSES = 32;

/** A report reduced to what validates, and the optional fields left out. */
export type LenientDebugCard =
	| { success: true; data: DebugCardRequest; dropped: string[] }
	| { success: false; issues: SchemaIssue[] };

function topLevelKey(path: string): string {
	return path.split('/')[1] ?? '';
}

/**
 * @description Validates a debug report, leaving out each optional field that fails instead of refusing the whole report,
 * so a client newer or older than the server still gets a card drawn from everything both understand.
 * @param value The untrusted report.
 * @returns The valid report and the fields left out, or the issues when a required field fails.
 */
// UNKNOWN: the untrusted report under validation.
export function parseDebugCardLeniently(value: unknown): LenientDebugCard {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return { success: false, issues: [{ path: '', message: 'The report must be an object' }] };
	}

	// UNKNOWN: each field stays untrusted until the schema checks it.
	const report = new Map<string, unknown>(Object.entries(value));
	const dropped: string[] = [];

	for (let pass = 0; pass < MAX_PASSES; pass++) {
		const result = safeParse(debugCardRequestSchema, Object.fromEntries(report));

		if (result.success) {
			return { success: true, data: result.data, dropped };
		}

		const keys = [...new Set(result.error.issues.map((issue) => topLevelKey(issue.path)))];

		if (keys.some((key) => !key || REQUIRED.has(key))) {
			return { success: false, issues: result.error.issues };
		}

		for (const key of keys) {
			report.delete(key);
			dropped.push(key);
		}
	}

	return {
		success: false,
		issues: [{ path: '', message: 'The report kept failing validation' }],
	};
}

export default parseDebugCardLeniently;
