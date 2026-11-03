import { addonManifestSchema, MANIFEST_FILENAME } from '@unbound-app/contracts/manifest';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import toError from '@unbound-app/utils/to-error';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { safeParse, Type, type StaticDecode, type TSchema } from './schema';

// A dev build only needs what the CLI reads; the device validates the rest when it loads the push.
// `Unsafe` types the loose schema with the manifest fields the CLI can read from it.
const devManifestSchema = Type.Unsafe<{ id: string; main: string } & Partial<PublishedManifest>>(
	Type.Object({ id: Type.String(), main: Type.String() }, { additionalProperties: true }),
);

type DevManifest = StaticDecode<typeof devManifestSchema>;

function readWith<T extends TSchema>(dir: string, schema: T): StaticDecode<T> {
	const path = join(dir, MANIFEST_FILENAME);
	let json: unknown;

	try {
		json = JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		throw new Error(`Could not read ${path}: ${toError(error).message}`);
	}

	const parsed = safeParse(schema, json);

	if (!parsed.success) {
		throw new Error(`Invalid ${path}:\n${parsed.error.message}`);
	}

	return parsed.data;
}

/**
 * @description Reads the manifest in an addon's directory and validates it against the publish rules.
 * @param dir The addon's directory.
 * @returns The validated manifest; throws naming the file when it is missing, not JSON or invalid.
 */
export function readManifest(dir: string): PublishedManifest {
	return readWith(dir, addonManifestSchema);
}

/**
 * @description Reads the manifest of an addon being developed, checking only its `id` and `main`.
 * @param dir The addon's directory.
 * @returns The manifest with every field kept; throws naming the file when it is missing, not JSON or lacks either field.
 */
export function readDevManifest(dir: string): DevManifest {
	return readWith(dir, devManifestSchema);
}

export default { readManifest, readDevManifest };
