import type { CommandDefinition, CommandOutput } from '@unbound-app/debugger-protocol/registry';
import type { DeviceInfo } from '@unbound-app/debugger-protocol';
import type { UnboundGlobal } from '@unbound-app/api/global';
import { z } from 'zod';

import { evaluateOnDevice, NOT_CONNECTED, toDeviceCode } from '~/lib/device';
import { logToStderr } from '~/lib/plugin-install';
import type { DeviceClient } from '~/lib/device';
import { bridgePortField } from '~/lib/context';
import { parseJson } from '~/lib/parse-json';

const schema = z.object({
	port: bridgePortField,
	watch: z
		.boolean()
		.default(false)
		.describe('Sample the native resources repeatedly and report which ones keep growing.'),
	interval: z.number().default(5_000).describe('Milliseconds between samples when watching.'),
	samples: z.number().default(12).describe('How many samples to take when watching.'),
});

const WATCHED_RESOURCES = ['handles', 'hooks', 'surfaces', 'cachedReturns'] as const;
const GROWTH_SHARE = 0.75;
const GROWTH_MINIMUM: Record<(typeof WATCHED_RESOURCES)[number], number> = {
	handles: 20,
	hooks: 1,
	surfaces: 1,
	cachedReturns: 10,
};

type ResourceSample = Record<string, number>;

type SampleAnalysis = { lines: string[]; growing: string[] };

/**
 * @description Summarises resource samples, flagging any that rose in most intervals and ended clearly higher.
 * @param samples The samples, oldest first.
 * @returns One line per resource, ending with whether it grew steadily.
 */
export function analyzeSamples(samples: ResourceSample[]): SampleAnalysis {
	const lines: string[] = [];
	const growing: string[] = [];

	for (const resource of WATCHED_RESOURCES) {
		const values = samples.map((sample) => sample[resource] ?? 0);

		if (values.length < 2) {
			continue;
		}

		const rises = values
			.slice(1)
			.filter((value, index) => value > (values[index] ?? value)).length;
		const first = values[0] ?? 0;
		const last = values.at(-1) ?? 0;
		const steady =
			rises / (values.length - 1) >= GROWTH_SHARE && last - first >= GROWTH_MINIMUM[resource];

		if (steady) {
			growing.push(resource);
		}

		lines.push(
			`${resource}: ${first} → ${last}, rose in ${rises} of ${values.length - 1} intervals${steady ? ' — growing steadily' : ''}`,
		);
	}

	return { lines, growing };
}

const deviceStatusReportSchema = z.object({
	started: z.number(),
	failed: z.array(z.string()),
	stopped: z.array(z.string()),
	resources: z.record(z.string(), z.number()).nullable(),
});

type DeviceStatusReport = z.infer<typeof deviceStatusReportSchema>;

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
function formatStatus(device: DeviceInfo | undefined, report: DeviceStatusReport): string {
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

async function readReport(client: DeviceClient): Promise<DeviceStatusReport | CommandOutput> {
	const result = await evaluateOnDevice(client, toDeviceCode(readDeviceStatus));

	if (!result) {
		return NOT_CONNECTED;
	}

	if (!result.ok) {
		return { ok: false, text: result.error };
	}

	const report = parseJson(result.value, deviceStatusReportSchema, 'The device');

	return report.ok ? report.value : { ok: false, text: report.error };
}

async function watchResources(client: DeviceClient, interval: number, count: number) {
	const taken: ResourceSample[] = [];

	for (let index = 0; index < count; index++) {
		if (index > 0) {
			await Bun.sleep(interval);
		}

		const report = await readReport(client);

		if ('text' in report) {
			return taken.length
				? summarize(taken, 'The device stopped answering; summary so far:')
				: report;
		}

		if (!report.resources) {
			return { ok: false, text: 'This loader does not report native resources.' };
		}

		taken.push(report.resources);
		logToStderr(
			`${index + 1}/${count} ${WATCHED_RESOURCES.map((name) => `${name} ${report.resources?.[name] ?? 0}`).join(', ')}`,
		);
	}

	return summarize(taken, `Sampled ${taken.length} times, ${interval} ms apart:`);
}

function summarize(taken: ResourceSample[], heading: string) {
	const { lines, growing } = analyzeSamples(taken);

	return {
		ok: growing.length === 0,
		text: [heading, ...lines].join('\n'),
		data: { samples: taken, growing },
	};
}

const statusCommand: CommandDefinition<typeof schema> = {
	name: 'status',
	description:
		'Show the device attached to the debugger bridge, its Discord, loader and client versions, how ' +
		'many plugins started, and the native hooks, surfaces and handles it holds after a garbage collection.',
	surfaces: { cli: 'root', mcp: true },
	schema,
	async handler({ watch, interval, samples }, { client }) {
		if (watch) {
			return watchResources(client, interval, Math.max(2, samples));
		}

		const report = await readReport(client);

		if ('text' in report) {
			return report;
		}

		return {
			ok: true,
			text: formatStatus(client.device, report),
			data: { device: client.device, ...report },
		};
	},
};

export default statusCommand;
