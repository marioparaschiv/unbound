import { existsSync, readFileSync } from 'node:fs';
import { z } from '@unbound-app/contracts/zod';
import { resolve } from 'node:path';

import { REPO_ROOT } from './paths';

const matrixDeviceSchema = z.object({
	name: z.string(),
	port: z.number(),
	serial: z.optional(z.string()),
	udid: z.optional(z.string()),
});

const matrixConfigSchema = z.object({
	channel: z.optional(z.string()),
	devices: z._default(z.array(matrixDeviceSchema), []),
});

export type MatrixDevice = z.infer<typeof matrixDeviceSchema>;

export type MatrixConfig = z.infer<typeof matrixConfigSchema>;

export const MATRIX_CONFIG_PATH = resolve(REPO_ROOT, '.device-matrix.json');

export function parseMatrixConfig(text: string): MatrixConfig {
	const result = matrixConfigSchema.safeParse(JSON.parse(text));

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

export function collectorArgs(
	device: MatrixDevice,
	out: string,
	channel: string | undefined,
	only: string | undefined,
	leakCycles?: number,
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
		...(leakCycles ? ['--leak-cycles', String(leakCycles)] : []),
	];
}

export default { collectorArgs, deviceSlug, parseMatrixConfig, readMatrixConfig };
