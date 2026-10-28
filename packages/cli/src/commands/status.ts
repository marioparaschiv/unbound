import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import type { DeviceInfo } from '@unbound-app/debugger-protocol';
import type { UnboundGlobal } from '@unbound-app/api/global';
import { z } from 'zod';

import { evaluateOnDevice, NOT_CONNECTED, toDeviceCode } from '~/lib/device';

const schema = z.object({
	port: z
		.number()
		.default(DEFAULT_BRIDGE_PORT)
		.describe('The port the debugger bridge listens on.'),
});

type DeviceStatusReport = {
	started: number;
	failed: string[];
	stopped: string[];
	resources: Record<string, number> | null;
};

type PluginManagerView = {
	getEntities(): { id: string; started: boolean; failed: boolean }[];
};

function readDeviceStatus(unbound: UnboundGlobal): string {
	const collect = (globalThis as { gc?: () => void }).gc;

	if (typeof collect === 'function') {
		collect();
	}

	const hasPlugins = (
		value: UnboundGlobal,
	): value is UnboundGlobal & { plugins: PluginManagerView } => 'plugins' in value;
	const entities = hasPlugins(unbound) ? unbound.plugins.getEntities() : [];
	const report: DeviceStatusReport = {
		started: entities.filter((entity) => entity.started).length,
		failed: entities.filter((entity) => entity.failed).map((entity) => entity.id),
		stopped: entities
			.filter((entity) => !entity.started && !entity.failed)
			.map((entity) => entity.id),
		resources: unbound.native.getNativeResources?.() ?? null,
	};

	return JSON.stringify(report);
}

/**
 * @description Describes the attached device from its hello.
 * @param device What the device reported, if it has said hello.
 * @returns A one-line summary.
 */
export function describeDevice(device: DeviceInfo | undefined): string {
	if (!device) {
		return 'connected, but its client predates the device hello';
	}

	return `${device.platform}, Discord ${device.discordVersion}, loader ${device.loaderVersion}, client ${device.clientVersion}`;
}

/**
 * @description Renders the status report.
 * @param device What the device reported in its hello.
 * @param report The plugin and resource counts read from the device.
 * @returns The lines `ubd status` prints.
 */
export function formatStatus(device: DeviceInfo | undefined, report: DeviceStatusReport): string {
	const lines = [
		`Device: ${describeDevice(device)}`,
		`Plugins: ${report.started} started, ${report.failed.length} failed, ${report.stopped.length} off`,
	];

	if (report.failed.length) {
		lines.push(`Failed: ${report.failed.join(', ')}`);
	}

	if (report.resources) {
		const { hooks, surfaces, handles, cachedReturns } = report.resources;

		lines.push(
			`Native resources after GC: ${handles ?? 0} handles, ${hooks ?? 0} hooks, ${surfaces ?? 0} surfaces, ${cachedReturns ?? 0} cached returns`,
		);
	} else {
		lines.push('Native resources: this loader does not report them');
	}

	return lines.join('\n');
}

const statusCommand: CommandDefinition<typeof schema> = {
	name: 'status',
	description:
		'Show the device attached to the debugger bridge, its Discord, loader and client versions, how ' +
		'many plugins started, and the native hooks, surfaces and handles it holds after a garbage collection.',
	surfaces: { cli: 'root', mcp: true },
	schema,
	async handler(_input, { client }) {
		const result = await evaluateOnDevice(client, toDeviceCode(readDeviceStatus));

		if (!result) {
			return NOT_CONNECTED;
		}

		if (!result.ok || typeof result.value !== 'string') {
			return {
				ok: false,
				text: result.error ?? 'The device did not answer the status check.',
			};
		}

		const report = JSON.parse(result.value) as DeviceStatusReport;

		return {
			ok: true,
			text: formatStatus(client.device, report),
			data: { device: client.device, ...report },
		};
	},
};

export default statusCommand;
