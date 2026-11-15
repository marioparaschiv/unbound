import { settings } from '@unbound-app/settings';
import { metro, patcher, storage } from '@unbound-app/api';

import { parseDurations, withDurations } from '~/lib/durations';
import { clearTime, durationName } from '~/lib/label';

type ClearAfter = number | string;
type Constants = { ClearAfterOptions: ClearAfter[] };
type Formatter = { default: (value: ClearAfter) => string };

const original: ClearAfter[] = [];
let stopWatching: (() => void) | undefined;

function findModule<T>(path: string): T | undefined {
	return metro.findByFilePath(`modules/custom_status/${path}.tsx`, { interop: false }) as
		| T
		| undefined;
}

function isAdded(value: ClearAfter): value is number {
	return typeof value === 'number' && !original.includes(value);
}

function isDiscordOption(format: Formatter | undefined, value: ClearAfter): boolean {
	try {
		format?.default(value);

		return true;
	} catch {
		return false;
	}
}

function patchFormatter(path: string, label: (ms: number) => string) {
	const module = findModule<Formatter>(path);

	if (!module)
		return logger.warn(
			`Custom status timeouts could not label options: Discord moved ${path}.`,
		);

	patcher.instead(module, 'default', ({ args: [value], original: format }) =>
		isAdded(value) ? label(value) : format(value),
	);
}

function applyDurations(constants: Constants) {
	constants.ClearAfterOptions = withDurations(original, parseDurations(settings.durations));
}

export function start() {
	const constants = findModule<Constants>('Constants');

	if (!constants?.ClearAfterOptions) {
		logger.warn('Custom status timeouts skipped: Discord moved its Clear after options.');

		return;
	}

	const optionFormatter = findModule<Formatter>('utils/formatClearAfterOption');
	const discordOptions = constants.ClearAfterOptions.filter((value) =>
		isDiscordOption(optionFormatter, value),
	);

	original.splice(0, original.length, ...discordOptions);
	patchFormatter(
		'utils/formatClearAfterOption',
		(ms) => `${durationName(ms)} (${clearTime(ms)})`,
	);
	patchFormatter('utils/formatClearAfterValue', (ms) => clearTime(ms));
	applyDurations(constants);
	stopWatching = storage.onChange(
		({ store }) => store === addon.id,
		() => applyDurations(constants),
	);
}

export function stop() {
	stopWatching?.();
	stopWatching = undefined;

	const constants = findModule<Constants>('Constants');

	if (constants && original.length) constants.ClearAfterOptions = [...original];

	original.length = 0;
	patcher.unpatchAll();
}
