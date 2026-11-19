import { join, relative, sep } from 'node:path';

import { diagnostic, type Diagnostic } from '~/lib/check/diagnostic';
import { parseFile, type ParsedFile } from '~/lib/check/parse-cache';
import { listSourceFiles } from '~/lib/checks/source-files';
import { Visitor } from '~/rollup/rolldown-utils';
import type { Check } from '~/lib/check/check';

const GLOBAL_OBJECTS = new Set(['globalThis', 'window', 'global']);
const SCOPED_GLOBALS = new Set(['setTimeout', 'setInterval', 'unbound']);
const SUBSCRIBERS: Record<string, string[]> = {
	AppState: ['addEventListener'],
	Keyboard: ['addListener'],
	Dimensions: ['addEventListener'],
	DeviceEventEmitter: ['addListener'],
	Linking: ['addEventListener'],
	AccessibilityInfo: ['addEventListener'],
};

/**
 * @description Finds what a plugin's scope cannot clean up on stop: timers and `unbound` reached through
 * `globalThis` or `window`, and React Native subscriptions in a file that never removes one.
 * @param parsed The parsed file.
 * @param file The file relative to the addon, for the diagnostics.
 * @returns One warning per finding.
 */
export function findUnscopedCleanup(parsed: ParsedFile, file: string): Diagnostic[] {
	const found: Diagnostic[] = [];
	const subscriptions: { start: number; name: string }[] = [];
	let removes = false;
	const visitor = new Visitor({
		MemberExpression(node) {
			if (
				node.object.type === 'Identifier' &&
				GLOBAL_OBJECTS.has(node.object.name) &&
				node.property.type === 'Identifier' &&
				SCOPED_GLOBALS.has(node.property.name)
			) {
				found.push(
					diagnostic({
						file,
						...parsed.locate(node.start),
						severity: 'warning',
						message: `${node.object.name}.${node.property.name} bypasses the plugin's scope, which cleans up on stop`,
						fix: `use the scoped ${node.property.name} global instead`,
					}),
				);
			}

			if (node.property.type === 'Identifier' && node.property.name === 'remove') {
				removes = true;
			}
		},
		CallExpression(node) {
			const { callee } = node;

			if (
				callee.type === 'MemberExpression' &&
				callee.object.type === 'Identifier' &&
				callee.property.type === 'Identifier' &&
				SUBSCRIBERS[callee.object.name]?.includes(callee.property.name)
			) {
				subscriptions.push({
					start: node.start,
					name: `${callee.object.name}.${callee.property.name}`,
				});
			}
		},
	});

	visitor.visit(parsed.result.program);

	if (removes) {
		return found;
	}

	return [
		...found,
		...subscriptions.map(({ start, name }) =>
			diagnostic({
				file,
				...parsed.locate(start),
				severity: 'warning',
				message: `${name} is never removed in this file, so it keeps running after the plugin stops`,
				fix: 'keep the subscription and call its remove() in stop',
			}),
		),
	];
}

export const scopedCleanupCheck: Check = {
	id: 'scoped-cleanup',
	/**
	 * @description Warns about globals and subscriptions a plugin's scope cannot remove when it stops.
	 * @param context The addon to check.
	 * @returns One warning per finding.
	 */
	run({ addon, cache }) {
		return listSourceFiles(join(addon.dir, 'src')).flatMap((path) =>
			findUnscopedCleanup(
				parseFile(cache.parse, path),
				relative(addon.dir, path).split(sep).join('/'),
			),
		);
	},
};

export default { findUnscopedCleanup, scopedCleanupCheck };
