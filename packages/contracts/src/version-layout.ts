import { MANIFEST_FILENAME } from './manifest-files.ts';

/** The extension of a bundle compiled to Hermes bytecode. */
const BYTECODE_EXTENSION = '.hbc';

/** A bytecode version as a compiled bundle's name carries it. */
const BYTECODE_VERSION = /^\d{1,10}$/;

/** The public keys a published version's manifest and bundle sit at. */
export type ArtifactKeys = {
	manifest: string;
	bundle: string;
};

/**
 * @description Builds the public folder a published version's files sit in, on the bucket and the CDN.
 * @param addonId The addon id.
 * @param version The published version.
 * @returns The folder, without a trailing slash.
 */
export function getVersionDirectory(addonId: string, version: string): string {
	return `addons/${addonId}/${version}`;
}

/**
 * @description Builds the public keys a version is published under. The bundle sits at `main`
 * relative to the manifest, which is how the client resolves it.
 * @param addonId The addon id.
 * @param version The published version.
 * @param main The manifest's `main`.
 * @returns The manifest and bundle keys.
 */
export function getArtifactKeys(addonId: string, version: string, main: string): ArtifactKeys {
	const directory = getVersionDirectory(addonId, version);

	return { manifest: `${directory}/${MANIFEST_FILENAME}`, bundle: `${directory}/${main}` };
}

/**
 * @description Names the bundle compiled to Hermes bytecode beside a source bundle, as builds write
 * it, the server publishes it and the loader and client look it up.
 * @param bundlePath The source bundle's path, key or URL, such as `dist/index.js`.
 * @param bytecodeVersion The Hermes bytecode version.
 * @returns The compiled bundle's path, such as `dist/index.98.hbc`.
 */
export function getBytecodePath(bundlePath: string, bytecodeVersion: string | number): string {
	return `${bundlePath.replace(/\.[^./]+$/, '')}.${bytecodeVersion}${BYTECODE_EXTENSION}`;
}

/**
 * @description Reads the bytecode version back from a file name {@link getBytecodePath} gave a bundle.
 * @param fileName The file name to read, such as `index.98.hbc`.
 * @param bundleName The source bundle's file name, such as `index.js`.
 * @returns The bytecode version, or `undefined` when the file is not that bundle compiled.
 */
export function readBytecodeVersion(fileName: string, bundleName: string): string | undefined {
	const prefix = getBytecodePath(bundleName, '').slice(0, -BYTECODE_EXTENSION.length);

	if (!fileName.startsWith(prefix) || !fileName.endsWith(BYTECODE_EXTENSION)) return;

	const version = fileName.slice(prefix.length, -BYTECODE_EXTENSION.length);

	return BYTECODE_VERSION.test(version) ? version : undefined;
}

/**
 * @description Builds the CDN URL of a public key, whether or not the CDN base ends in a slash.
 * @param cdnUrl The CDN's base URL.
 * @param key The public key.
 * @returns The URL below `cdnUrl`.
 */
export function getCdnUrl(cdnUrl: string, key: string): string {
	return new URL(key, cdnUrl.endsWith('/') ? cdnUrl : `${cdnUrl}/`).href;
}

export default {
	getVersionDirectory,
	getArtifactKeys,
	getBytecodePath,
	readBytecodeVersion,
	getCdnUrl,
};
