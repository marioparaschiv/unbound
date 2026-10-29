import type { CommandRunner, DropTarget } from './device-drops';

export type MemoryReport = {
	beforeMB?: number;
	afterMB?: number;
	relaunched: boolean;
	springBoard?: ProcessMemory;
};

export type ProcessMemory = { footprintMB: number; peakMB: number };

type ListedProcess = { name?: string; footprintMB?: number; peakFootprintMB?: number };

export const SPRINGBOARD_WARNING_MB = 300;

const KILOBYTES_PER_MB = 1024;

/**
 * @description Reads Discord's footprint from `jb-p1lot process_memory` output.
 * @param output The command's JSON output.
 * @returns The footprint in megabytes, or `undefined` when Discord is not running.
 */
export function parseIOSFootprint(output: string): number | undefined {
	return parseProcessMemory(output, 'Discord')?.footprintMB;
}

/**
 * @description Reads one process's footprint and peak from `jb-p1lot process_memory` output.
 * @param output The command's JSON output.
 * @param name The exact process name.
 * @returns The footprint and peak in megabytes, or `undefined` when the process is not listed.
 */
export function parseProcessMemory(output: string, name: string): ProcessMemory | undefined {
	try {
		const { processes } = JSON.parse(output) as { processes?: ListedProcess[] };
		const found = processes?.find((process) => process.name === name);

		return found?.footprintMB === undefined
			? undefined
			: {
					footprintMB: found.footprintMB,
					peakMB: found.peakFootprintMB ?? found.footprintMB,
				};
	} catch {
		return undefined;
	}
}

/**
 * @description Measures SpringBoard on an iOS device, where a leak in the device agent would show.
 * @param target The device.
 * @param run Runs a host command.
 * @returns SpringBoard's footprint and peak, or `undefined` off iOS or when it could not be read.
 */
export async function springBoardMemory(
	target: DropTarget,
	run: CommandRunner,
): Promise<ProcessMemory | undefined> {
	if (target.kind !== 'ios') return undefined;

	const { stdout } = await run([
		'jb-p1lot',
		'process_memory',
		'--device',
		target.udid,
		'--process',
		'SpringBoard',
		'--limit',
		'5',
	]);

	return parseProcessMemory(stdout, 'SpringBoard');
}

/**
 * @description Describes SpringBoard's memory at the end of a run, flagging it above the warning level.
 * @param memory The reading.
 * @returns A line such as `SpringBoard 76 MB (peak 95 MB)`.
 */
export function describeSpringBoard(memory: ProcessMemory): string {
	const line = `SpringBoard ${Math.round(memory.footprintMB)} MB (peak ${Math.round(memory.peakMB)} MB)`;

	return memory.footprintMB > SPRINGBOARD_WARNING_MB
		? `${line}, **above ${SPRINGBOARD_WARNING_MB} MB: check the device agent for a leak**`
		: line;
}

/**
 * @description Reads the total proportional set size from `dumpsys meminfo`.
 * @param output The command output.
 * @returns The total PSS in megabytes, or `undefined` when it is missing.
 */
export function parseAndroidPss(output: string): number | undefined {
	const kilobytes = /TOTAL PSS:\s+(\d+)/.exec(output)?.[1];

	return kilobytes ? Math.round(Number(kilobytes) / KILOBYTES_PER_MB) : undefined;
}

/**
 * @description Measures Discord's memory on a device.
 * @param target The device.
 * @param run Runs a host command.
 * @returns Megabytes in use, or `undefined` when it could not be read.
 */
export async function discordMemory(
	target: DropTarget,
	run: CommandRunner,
): Promise<number | undefined> {
	if (target.kind === 'android') {
		const serial = target.serial ? ['-s', target.serial] : [];
		const { stdout } = await run([
			'adb',
			...serial,
			'shell',
			'dumpsys',
			'meminfo',
			'com.discord',
		]);

		return parseAndroidPss(stdout);
	}

	const { stdout } = await run([
		'jb-p1lot',
		'process_memory',
		'--device',
		target.udid,
		'--process',
		'Discord',
		'--limit',
		'5',
	]);

	return parseIOSFootprint(stdout);
}

/**
 * @description Describes how Discord's memory changed over a run.
 * @param report The measurements.
 * @returns A line such as `312 MB → 340 MB (+28 MB)`, or `undefined` without both readings.
 */
export function describeMemory(report: MemoryReport): string | undefined {
	if (report.beforeMB === undefined || report.afterMB === undefined) return undefined;

	const before = Math.round(report.beforeMB);
	const after = Math.round(report.afterMB);
	const change = after - before;
	const sign = change >= 0 ? '+' : '−';
	const line = `${before} MB → ${after} MB (${sign}${Math.abs(change)} MB)`;

	return report.relaunched ? `${line}, Discord relaunched during the run` : line;
}

export type PluginGrowth = { id: string; memoryDeltaMB?: number };

export const GROWTH_THRESHOLD_MB = 5;
const LISTED_GROWERS = 5;

/**
 * @description Picks the plugins whose cycle grew Discord's memory the most.
 * @param checks Each plugin's check with its measured growth.
 * @returns Up to five `id (+N MB)` entries at or above the threshold, largest first.
 */
export function largestGrowers(checks: PluginGrowth[]): string[] {
	return checks
		.filter((check) => (check.memoryDeltaMB ?? 0) >= GROWTH_THRESHOLD_MB)
		.sort((a, b) => (b.memoryDeltaMB ?? 0) - (a.memoryDeltaMB ?? 0))
		.slice(0, LISTED_GROWERS)
		.map((check) => `${check.id} (+${check.memoryDeltaMB} MB)`);
}
