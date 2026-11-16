import { strToU8, zipSync, type Zippable } from 'fflate';

import fs from '~/native/fs';

import { scrubLogLine } from './crash-report';

const LOG_FOLDER = 'Unbound/Logs';
const LOG_NAMES = ['unbound', 'native'] as const;
const LOG_ROTATIONS = ['', '.1', '.2', '.3'] as const;
const STATE_FILES = [
	'Unbound/native-crash.txt',
	'Unbound/crash-history.json',
	'Unbound/addon-running.json',
	'Unbound/addon-starting.json',
] as const;
const COMPRESSION_LEVEL = 6;
const BASE64_CHUNK = 0x8000;

export type DiagnosticsInput = {
	report: unknown;
	entitlements?: string;
};

async function readIfPresent(path: string): Promise<string | undefined> {
	try {
		return (await fs.exists(path)) ? await fs.readFile(path) : undefined;
	} catch {
		return undefined;
	}
}

function scrubLog(text: string): string {
	return text.split('\n').map(scrubLogLine).join('\n');
}

function logPaths(): string[] {
	return LOG_NAMES.flatMap((name) =>
		LOG_ROTATIONS.map((rotation) => `${LOG_FOLDER}/${name}${rotation}.log`),
	);
}

function toBase64(bytes: Uint8Array): string {
	let binary = '';

	for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK));
	}

	return btoa(binary);
}

/**
 * @description Zips the loader's logs, scrubbed of secrets, its crash and addon state files and the debug report.
 * @param input The debug report and, on iOS, the app's entitlements.
 * @returns The zip as base64, ready to write to a file.
 */
export async function buildDiagnosticsZip({
	report,
	entitlements,
}: DiagnosticsInput): Promise<string> {
	const files: Zippable = {
		'debug-info.json': strToU8(JSON.stringify(report, null, '\t')),
	};

	for (const path of logPaths()) {
		const text = await readIfPresent(path);

		if (text) {
			files[`logs/${path.slice(LOG_FOLDER.length + 1)}`] = strToU8(scrubLog(text));
		}
	}

	for (const path of STATE_FILES) {
		const text = await readIfPresent(path);

		if (text) {
			files[`state/${path.slice(path.lastIndexOf('/') + 1)}`] = strToU8(text);
		}
	}

	if (entitlements) {
		files['Entitlements.xml'] = strToU8(entitlements);
	}

	return toBase64(zipSync(files, { level: COMPRESSION_LEVEL }));
}
