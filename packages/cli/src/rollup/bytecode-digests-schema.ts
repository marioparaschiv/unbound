// From typebox itself: rollup configs load this file under Node, which cannot resolve the contracts' extensionless imports.
import { Type, type StaticDecode } from 'typebox';

/**
 * The build-output file naming the bytecode one build compiled. No published or installed file list
 * holds it; `ubd` reads it to tell this build's bytecode from a leftover of an earlier build.
 */
export const BYTECODE_DIGESTS_FILENAME = 'bytecode-digests.json';

const sha512 = Type.String({ pattern: '^[0-9a-f]{128}$' });

/** One bundle the build wrote: its SHA-512, and the SHA-512 of each bytecode file compiled from it, by Hermes bytecode version. */
export const bundleDigestsSchema = Type.Object({
	sha512,
	bytecode: Type.Record(Type.String({ pattern: '^\\d{1,10}$' }), sha512, {
		additionalProperties: false,
	}),
});

/** Each bundle's digests, by its file name in the output directory, such as `index.js`. */
export const bytecodeDigestsSchema = Type.Record(Type.String(), bundleDigestsSchema, {
	additionalProperties: false,
});

export type BytecodeDigests = StaticDecode<typeof bytecodeDigestsSchema>;

export default { BYTECODE_DIGESTS_FILENAME, bundleDigestsSchema, bytecodeDigestsSchema };
