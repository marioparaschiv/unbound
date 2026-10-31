import { addonManifestSchema, MANIFEST_FILENAME } from '@unbound-app/contracts/manifest';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import toError from '@unbound-app/utils/to-error';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

// A dev build only needs what the CLI reads; the device validates the rest when it loads the push.
const devManifestSchema = z.looseObject({ id: z.string(), main: z.string() });

type DevManifest = z.infer<typeof devManifestSchema>;

function readWith<T>(dir: string, schema: z.core.$ZodType<T>): T {
	const path = join(dir, MANIFEST_FILENAME);
	let json: unknown;

	try {
		json = JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		throw new Error(`Could not read ${path}: ${toError(error).message}`);
	}

	const parsed = z.safeParse(schema, json);

	if (!parsed.success) {
		throw new Error(`Invalid ${path}:\n${z.prettifyError(parsed.error)}`);
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
