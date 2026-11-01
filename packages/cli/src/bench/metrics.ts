import type { MemorySample, RunRecord } from '~/bench/record';

export type Unit = 'ms' | 'MB' | 'count';

/** One reported number: how to read it from a launch, and how to print it. */
export type Metric = {
	key: string;
	label: string;
	unit: Unit;
	read: (record: RunRecord) => number | undefined;
};

const MEGABYTE = 1024 * 1024;

function between(end: number | undefined, start: number | undefined): number | undefined {
	return end === undefined || start === undefined ? undefined : end - start;
}

function hermes(sample: MemorySample | null, field: string, scale = 1): number | undefined {
	const value = sample?.hermes?.[field];

	return value === undefined ? undefined : value * scale;
}

function megabytes(bytes: number | null | undefined): number | undefined {
	return bytes === null || bytes === undefined ? undefined : bytes / MEGABYTE;
}

function startTotal(record: RunRecord): number | undefined {
	return record.pluginStartMs
		? Object.values(record.pluginStartMs).reduce((sum, ms) => sum + ms, 0)
		: undefined;
}

/** Every number the report summarises, in report order. Startup times count from the runtime's creation. */
export const METRICS: Metric[] = [
	{
		key: 'bundle_executed_ms',
		label: "Unbound's bundle executed",
		unit: 'ms',
		read: (r) => r.startup.bundleExecuted,
	},
	{
		key: 'initialized_ms',
		label: 'Unbound initialized, plugins started',
		unit: 'ms',
		read: (r) => r.startup.initialized,
	},
	{
		key: 'unbound_run_ms',
		label: "Unbound's bundle run, attempt to executed",
		unit: 'ms',
		read: (r) => between(r.startup.bundleExecuted, r.startup.bundleStart),
	},
	{
		key: 'discord_first_render_ms',
		label: "Discord's first React render",
		unit: 'ms',
		read: (r) => r.discord.firstRender,
	},
	{
		key: 'discord_fcp_ms',
		label: "Discord's first contentful paint",
		unit: 'ms',
		read: (r) => r.discord.fcp,
	},
	{
		key: 'discord_latest_messages_ms',
		label: 'Discord shows the latest messages',
		unit: 'ms',
		read: (r) => r.discord.latestMessages,
	},
	{
		key: 'heap_init_mb',
		label: 'Hermes heap after init',
		unit: 'MB',
		read: (r) => hermes(r.memory.init, 'js_heapSize', 1 / MEGABYTE),
	},
	{
		key: 'heap_idle_mb',
		label: 'Hermes heap at idle',
		unit: 'MB',
		read: (r) => hermes(r.memory.idle, 'js_heapSize', 1 / MEGABYTE),
	},
	{
		key: 'allocated_idle_mb',
		label: 'Hermes live allocations at idle',
		unit: 'MB',
		read: (r) => hermes(r.memory.idle, 'js_allocatedBytes', 1 / MEGABYTE),
	},
	{
		key: 'gc_count_idle',
		label: 'Hermes GCs by idle',
		unit: 'count',
		read: (r) => hermes(r.memory.idle, 'js_numGCs'),
	},
	{
		key: 'gc_time_idle_ms',
		label: 'Hermes GC time by idle',
		unit: 'ms',
		read: (r) => hermes(r.memory.idle, 'js_gcTime', 1000),
	},
	{
		key: 'footprint_init_mb',
		label: 'Process footprint after init',
		unit: 'MB',
		read: (r) => megabytes(r.memory.init?.footprintBytes),
	},
	{
		key: 'footprint_idle_mb',
		label: 'Process footprint at idle',
		unit: 'MB',
		read: (r) => megabytes(r.memory.idle?.footprintBytes),
	},
	{
		key: 'resident_idle_mb',
		label: 'Process resident memory at idle',
		unit: 'MB',
		read: (r) => megabytes(r.memory.idle?.residentBytes),
	},
	{
		key: 'modules_idle',
		label: 'Metro modules initialized at idle',
		unit: 'count',
		read: (r) => r.work.modulesInitialized ?? undefined,
	},
	{ key: 'plugin_start_total_ms', label: 'Plugin start() total', unit: 'ms', read: startTotal },
];

/**
 * @description Prints a metric's value in its unit, rounded for reading.
 * @param value The value.
 * @param unit Its unit.
 * @returns The text, such as `312 ms` or `48.1 MB`.
 */
export function formatValue(value: number, unit: Unit): string {
	switch (unit) {
		case 'ms':
			return `${Math.round(value).toLocaleString('en-US')} ms`;
		case 'MB':
			return `${value.toFixed(1)} MB`;
		case 'count':
			return Math.round(value).toLocaleString('en-US');
	}
}

export default { METRICS, formatValue };
