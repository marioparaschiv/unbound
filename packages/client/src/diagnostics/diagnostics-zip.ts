import { strToU8, zipSync, type Zippable } from 'fflate';

import fs from '~/native/fs';

import { crashStackFiles } from './crash-stack-files';
import { scrubLogLine } from './crash-report';

const LOG_FOLDER = 'Unbound/Logs';
const LOG_NAMES = ['unbound', 'native'] as const;
const LOG_ROTATIONS = ['', '.1', '.2', '.3'] as const;
const CRASH_HISTORY = 'Unbound/crash-history.json';
const STATE_FILES = [
	'Unbound/native-crash.txt',
	CRASH_HISTORY,
	'Unbound/addon-running.json',
	'Unbound/addon-starting.json',
] as const;
const COMPRESSION_LEVEL = 4;
const MAX_LOG_CHARS = 512 * 1024;
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
	const newest =
		text.length > MAX_LOG_CHARS
			? text.slice(text.indexOf('\n', text.length - MAX_LOG_CHARS) + 1)
			: text;

	return newest.split('\n').map(scrubLogLine).join('\n');
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
 * @description Zips the loader's logs, scrubbed of secrets, its crash and addon state files, each recorded crash's stack,
 * the debug report and each plugin's declared and used native capabilities.
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

	for (const [name, stack] of Object.entries(
		crashStackFiles((await readIfPresent(CRASH_HISTORY)) ?? '[]'),
	)) {
		files[name] = strToU8(stack);
	}

	if (entitlements) {
		files['Entitlements.xml'] = strToU8(entitlements);
	}

	const { capabilityUse } = await import('~/native/capability-use');

	files['capability-use.json'] = strToU8(JSON.stringify(capabilityUse(), null, '\t'));

	return toBase64(zipSync(files, { level: COMPRESSION_LEVEL }));
}
