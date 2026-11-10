import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { BYTECODE_DIGESTS_FILENAME } from '~/rollup/bytecode-digests-schema';
import { bytecodeFileName } from '~/rollup/hermes-bytecode';

const sha512 = (contents: Buffer | string) => createHash('sha512').update(contents).digest('hex');

/**
 * @description Writes bytecode beside a built bundle and records it as `hermesBytecode` does, so a reader takes it as this build's.
 * @param output The build's output directory, holding the bundle.
 * @param bundle The bundle's file name, such as `index.js`.
 * @param bytecode Each compiled file's contents, by Hermes bytecode version.
 */
export function writeBuiltBytecode(
	output: string,
	bundle: string,
	bytecode: Record<number, Buffer | string>,
) {
	const digests: Record<string, string> = {};

	for (const [version, contents] of Object.entries(bytecode)) {
		writeFileSync(join(output, bytecodeFileName(bundle, Number(version))), contents);
		digests[version] = sha512(contents);
	}

	writeFileSync(
		join(output, BYTECODE_DIGESTS_FILENAME),
		JSON.stringify({
			[bundle]: { sha512: sha512(readFileSync(join(output, bundle))), bytecode: digests },
		}),
	);
}

export default writeBuiltBytecode;
