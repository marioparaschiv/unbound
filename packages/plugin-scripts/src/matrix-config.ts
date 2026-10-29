import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { REPO_ROOT } from './paths';

export type MatrixDevice = {
	name: string;
	port: number;
	serial?: string;
	udid?: string;
};

export type MatrixConfig = {
	channel?: string;
	devices: MatrixDevice[];
};

export const MATRIX_CONFIG_PATH = resolve(REPO_ROOT, '.device-matrix.json');

function isDevice(value: unknown): value is MatrixDevice {
	if (!value || typeof value !== 'object') return false;

	const device = value as Partial<MatrixDevice>;

	return typeof device.name === 'string' && typeof device.port === 'number';
}

export function parseMatrixConfig(text: string): MatrixConfig {
	const parsed = JSON.parse(text) as Partial<MatrixConfig>;
	const devices = Array.isArray(parsed.devices) ? parsed.devices : [];

	if (!devices.every(isDevice)) {
		throw new Error('Every device in the matrix config needs a name and a port.');
	}

	return {
		...(typeof parsed.channel === 'string' ? { channel: parsed.channel } : {}),
		devices,
	};
}

export function readMatrixConfig(path: string = MATRIX_CONFIG_PATH): MatrixConfig | undefined {
	return existsSync(path) ? parseMatrixConfig(readFileSync(path, 'utf8')) : undefined;
}

export function deviceSlug(device: MatrixDevice): string {
	return device.name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

export function collectorArgs(
	device: MatrixDevice,
	out: string,
	channel: string | undefined,
	only: string | undefined,
): string[] {
	return [
		'--port',
		String(device.port),
		'--out',
		out,
		'--device',
		device.name,
		...(device.udid ? ['--udid', device.udid] : []),
		...(device.serial ? ['--serial', device.serial] : []),
		...(channel ? ['--channel', channel] : []),
		...(only ? ['--only', only] : []),
	];
}

export default { collectorArgs, deviceSlug, parseMatrixConfig, readMatrixConfig };
