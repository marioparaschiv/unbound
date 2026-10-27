import {
	createHash,
	createPrivateKey,
	createPublicKey,
	sign,
	verify,
	type KeyObject,
} from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Logger from '@unbound-app/logger';
import { z } from 'zod';

const logger = Logger.create('Build', 'Sign');

export const SIGNING_KEY_VARIABLE = 'UNBOUND_BUNDLE_SIGNING_KEY';

export const PR_SIGNING_KEY_VARIABLE = 'UNBOUND_PR_BUNDLE_SIGNING_KEY';

export const SIGNATURE_SUFFIX = '.sig';

export const MANIFEST_FILE = 'manifest.json';

const BUILD_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export type SignOptions = {
	pullRequest?: number;
};

/**
 * @description Builds the prefix a pull request key signs in front of every file, binding the signature to that pull request.
 * @param pullRequest The pull request number.
 * @returns `unbound-pr-bundle/v1/<number>/`.
 */
export function pullRequestSigningContext(pullRequest: number): string {
	return `unbound-pr-bundle/v1/${pullRequest}/`;
}

/**
 * @description Builds the exact bytes a signature covers: the file itself, or the pull request context followed by it.
 * @param contents The file contents.
 * @param pullRequest The pull request number, or 0 for production signatures.
 * @returns The signed message.
 */
export function signedMessage(contents: Buffer, pullRequest = 0): Buffer {
	if (!pullRequest) {
		return contents;
	}

	return Buffer.concat([Buffer.from(pullRequestSigningContext(pullRequest)), contents]);
}

/**
 * @description Lists the client bundles in a build directory that the loader may download.
 * @param dir The build output directory.
 * @returns The bundle file names, sorted.
 */
export function signableBundles(dir: string): string[] {
	return readdirSync(dir)
		.filter(
			(file) =>
				file.startsWith('unbound.') && (file === 'unbound.js' || file.endsWith('.bundle')),
		)
		.sort();
}

/**
 * @description Hashes every bundle in a build directory with SHA-512, the hashes the signed manifest lists.
 * @param dir The build output directory.
 * @returns The lowercase hex SHA-512 of each bundle, keyed by file name.
 */
export function bundleHashes(dir: string): Record<string, string> {
	return Object.fromEntries(
		signableBundles(dir).map((file) => [
			file,
			createHash('sha512')
				.update(readFileSync(join(dir, file)))
				.digest('hex'),
		]),
	);
}

/**
 * @description Parses the signing key, failing unless it is an Ed25519 private key.
 * @param pem The PEM private key.
 * @returns The parsed key.
 */
export function parseSigningKey(pem: string): KeyObject {
	const key = createPrivateKey(pem.replaceAll('\r', ''));

	if (key.asymmetricKeyType !== 'ed25519') {
		throw new Error('The bundle signing key must be an Ed25519 private key.');
	}

	return key;
}

const buildManifestSchema = z.looseObject({
	revision: z.string().optional(),
	channel: z.string().optional(),
	buildTime: z.string().optional(),
	sha512: z.record(z.string(), z.string()).optional(),
});

type BuildManifest = z.infer<typeof buildManifestSchema>;

function readManifest(dir: string): BuildManifest {
	const path = join(dir, MANIFEST_FILE);

	if (!existsSync(path)) {
		throw new Error(`${dir} has no ${MANIFEST_FILE} to sign.`);
	}

	const parsed = buildManifestSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));

	if (!parsed.success) {
		throw new Error(`${MANIFEST_FILE} is not a build manifest: ${parsed.error.message}`);
	}

	return parsed.data;
}

function manifestFieldProblems(manifest: BuildManifest): string[] {
	const problems: string[] = [];

	if (!manifest.buildTime || !BUILD_TIME_PATTERN.test(manifest.buildTime)) {
		problems.push(`${MANIFEST_FILE} has no ISO 8601 UTC buildTime.`);
	}

	if (!manifest.revision) {
		problems.push(`${MANIFEST_FILE} has no revision.`);
	}

	if (!manifest.channel) {
		problems.push(`${MANIFEST_FILE} has no channel.`);
	}

	return problems;
}

function writeSignature(dir: string, file: string, key: KeyObject, pullRequest: number) {
	const contents = readFileSync(join(dir, file));
	const signature = sign(null, signedMessage(contents, pullRequest), key).toString('base64');

	writeFileSync(join(dir, `${file}${SIGNATURE_SUFFIX}`), `${signature}\n`);
}

/**
 * @description Signs a build: records every bundle's SHA-512 in `manifest.json`, then writes a base64 Ed25519 signature next to every bundle and the manifest, after removing stale ones. Without a key the build stays unsigned.
 * @param dir The build output directory.
 * @param pem The PEM private key, read from {@link SIGNING_KEY_VARIABLE} by default.
 * @param options The pull request the signatures are bound to, for the pull request key.
 * @returns The file names that were signed.
 */
export function signBundles(
	dir: string,
	pem = process.env[SIGNING_KEY_VARIABLE],
	options: SignOptions = {},
): string[] {
	for (const file of readdirSync(dir).filter((name) => name.endsWith(SIGNATURE_SUFFIX))) {
		rmSync(join(dir, file));
	}

	if (!pem?.trim()) {
		logger.warn(`${SIGNING_KEY_VARIABLE} is not set; the bundles are unsigned.`);

		return [];
	}

	const pullRequest = options.pullRequest ?? 0;
	const key = parseSigningKey(pem);
	const manifest = readManifest(dir);
	const problems = manifestFieldProblems(manifest);

	if (problems.length) {
		throw new Error(`${problems.join(' ')} Rebuild with the current build script.`);
	}

	manifest.sha512 = bundleHashes(dir);
	writeFileSync(join(dir, MANIFEST_FILE), JSON.stringify(manifest, null, 2));

	const files = [...signableBundles(dir), MANIFEST_FILE];

	for (const file of files) {
		writeSignature(dir, file, key, pullRequest);
	}

	const signer = pullRequest ? `the key for pull request #${pullRequest}` : 'the production key';

	logger.success(`Signed ${files.join(', ')} with ${signer}`);

	return files;
}

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * @description Parses a raw 32-byte Ed25519 public key encoded as base64, the format the loader compiles in.
 * @param base64 The base64 public key.
 * @returns The parsed key.
 */
export function parsePublicKey(base64: string): KeyObject {
	const raw = Buffer.from(base64.trim(), 'base64');

	if (raw.length !== 32) {
		throw new Error(`The bundle signing public key is ${raw.length} bytes, not 32.`);
	}

	return createPublicKey({
		key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
		format: 'der',
		type: 'spki',
	});
}

function signatureProblem(
	dir: string,
	file: string,
	key: KeyObject,
	pullRequest: number,
): string | undefined {
	const signaturePath = join(dir, `${file}${SIGNATURE_SUFFIX}`);

	if (!existsSync(signaturePath)) {
		return `${file} has no signature.`;
	}

	const signature = Buffer.from(readFileSync(signaturePath, 'utf8').trim(), 'base64');
	const message = signedMessage(readFileSync(join(dir, file)), pullRequest);
	const valid = signature.length === 64 && verify(null, message, key, signature);

	return valid ? undefined : `${file} does not match its signature.`;
}

function manifestProblems(dir: string, key: KeyObject, pullRequest: number): string[] {
	if (!existsSync(join(dir, MANIFEST_FILE))) {
		return [`${dir} has no ${MANIFEST_FILE}.`];
	}

	const signature = signatureProblem(dir, MANIFEST_FILE, key, pullRequest);

	if (signature) {
		return [signature];
	}

	const manifest = readManifest(dir);
	const listed = manifest.sha512 ?? {};
	const actual = bundleHashes(dir);
	const problems = manifestFieldProblems(manifest);

	for (const [file, hash] of Object.entries(actual)) {
		if (listed[file] !== hash) {
			problems.push(`${file} does not match its SHA-512 in ${MANIFEST_FILE}.`);
		}
	}

	for (const file of Object.keys(listed).filter((file) => !(file in actual))) {
		problems.push(`${MANIFEST_FILE} lists ${file}, which the build lacks.`);
	}

	return problems;
}

/**
 * @description Checks that every bundle and the manifest in a build directory carry signatures the public key verifies, and that the manifest hashes every bundle.
 * @param dir The build output directory.
 * @param publicKeyBase64 The raw Ed25519 public key as base64.
 * @param pullRequest The pull request the signatures must be bound to, or 0 for production signatures.
 * @returns A problem per missing or invalid signature or hash, empty when all verify.
 */
export function findUnsignedBundles(
	dir: string,
	publicKeyBase64: string,
	pullRequest = 0,
): string[] {
	const key = parsePublicKey(publicKeyBase64);
	const bundles = signableBundles(dir);

	if (!bundles.length) {
		return [`${dir} has no bundles.`];
	}

	const signatures = bundles.flatMap(
		(file) => signatureProblem(dir, file, key, pullRequest) ?? [],
	);

	return [...signatures, ...manifestProblems(dir, key, pullRequest)];
}

export type SignArguments = {
	dir: string;
	pullRequest: number;
	keyVariable: string;
};

/**
 * @description Parses a pull request number from the command line.
 * @param value The argument after `--pr`.
 * @returns The pull request number.
 */
export function parsePullRequest(value: string | undefined): number {
	if (!value || !/^[1-9]\d{0,8}$/.test(value)) {
		throw new Error(`--pr needs a pull request number, not ${value ?? 'nothing'}.`);
	}

	return Number(value);
}

/**
 * @description Parses `sign.ts` arguments: `--dir <dist>`, `--pr <n>` and `--key-env <VAR>`.
 * @param argv The arguments after the script name.
 * @param root The directory a relative `--dir` resolves against.
 * @returns The build directory, pull request and the environment variable holding the key.
 */
export function parseSignArguments(argv: string[], root = process.cwd()): SignArguments {
	const parsed: SignArguments = {
		dir: resolve(root, 'dist'),
		pullRequest: 0,
		keyVariable: '',
	};

	for (let index = 0; index < argv.length; index++) {
		const flag = argv[index];
		const value = argv[++index];

		if (flag === '--dir' && value) {
			parsed.dir = resolve(root, value);
		} else if (flag === '--pr') {
			parsed.pullRequest = parsePullRequest(value);
		} else if (flag === '--key-env' && value && /^[A-Z_][A-Z0-9_]*$/.test(value)) {
			parsed.keyVariable = value;
		} else {
			throw new Error(
				`Unknown argument ${flag}. Usage: sign.ts [--dir <dist>] [--pr <n>] [--key-env <VAR>]`,
			);
		}
	}

	parsed.keyVariable ||= parsed.pullRequest ? PR_SIGNING_KEY_VARIABLE : SIGNING_KEY_VARIABLE;

	return parsed;
}

export default signBundles;

if (import.meta.main) {
	try {
		const options = parseSignArguments(
			process.argv.slice(2),
			join(import.meta.dir, '..', '..'),
		);
		const pem = process.env[options.keyVariable];

		if (!pem?.trim()) {
			throw new Error(`${options.keyVariable} is not set.`);
		}

		signBundles(options.dir, pem, { pullRequest: options.pullRequest });
	} catch (error) {
		logger.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}
