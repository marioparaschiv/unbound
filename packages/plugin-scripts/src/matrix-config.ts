import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { REPO_ROOT } from './paths';
import { Type, safeParse, type Static } from '@unbound-app/contracts/schema';

const matrixDeviceSchema = Type.Object({
	name: Type.String(),
	port: Type.Number(),
	serial: Type.Optional(Type.String()),
	udid: Type.Optional(Type.String()),
});

const matrixConfigSchema = Type.Object({
	channel: Type.Optional(Type.String()),
	devices: Type.Array(matrixDeviceSchema, { default: [] }),
});

export type MatrixDevice = Static<typeof matrixDeviceSchema>;

export type MatrixConfig = Static<typeof matrixConfigSchema>;

export const MATRIX_CONFIG_PATH = resolve(REPO_ROOT, '.device-matrix.json');

export function parseMatrixConfig(text: string): MatrixConfig {
	const result = safeParse(matrixConfigSchema, JSON.parse(text));

	if (!result.success) {
		throw new Error(
			`The matrix config needs an optional string channel and devices with a name and a port: ${result.error.message}`,
		);
	}

	return result.data;
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

export default { deviceSlug, parseMatrixConfig, readMatrixConfig };
