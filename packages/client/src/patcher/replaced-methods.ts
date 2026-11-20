import { PATCH_SYMBOL, patches, type PatchParent } from 'possess';
import { createLogger } from '@unbound-app/logger';

type PatchRecord = (typeof patches)[number];

const logger = createLogger('Patcher', 'Replaced');

function isPatchable(value: unknown): value is PatchRecord['original'] {
	return typeof value === 'function';
}

function adoptIfReplaced(record: PatchRecord): void {
	const parent = record.parent.deref();
	const current = parent ? Reflect.get(parent, record.method) : undefined;

	if (!isPatchable(current) || current === record.original) {
		return;
	}

	if (Reflect.get(current, PATCH_SYMBOL)) {
		return;
	}

	logger.warn(
		`Failed to keep patches on ${String(record.method)}: something replaced it after it was patched; patching over the replacement instead.`,
	);
	record.original = current;
}

/**
 * @description Notices a patched method that was replaced since it was patched, and makes the replacement its original,
 * so the next patch wraps it and the last unpatch restores it instead of an older function.
 * @param parent The object holding the method.
 * @param method The method's key.
 */
export function adoptReplacedMethod(parent: PatchParent, method: PropertyKey): void {
	const record = patches.find(
		(entry) => entry.method === method && entry.parent.deref() === parent,
	);

	if (record) {
		adoptIfReplaced(record);
	}
}

/**
 * @description Runs `adoptReplacedMethod` over every patched method, before patches are removed in bulk.
 */
export function adoptReplacedMethods(): void {
	for (const record of patches) adoptIfReplaced(record);
}

export default { adoptReplacedMethod, adoptReplacedMethods };
