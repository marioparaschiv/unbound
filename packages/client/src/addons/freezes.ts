import type { createLogger } from '@unbound-app/logger';

import { crashReportAddon } from '~/diagnostics/crash-report';
import { reportCrash } from '~/diagnostics/crash-reports';
import type { AddonFreeze } from '~/addons/crash-guard';
import type { Addon } from '~/addons/addon';
import { show } from '~/toasts/api';

type FrozenAddon = Pick<Addon, 'id' | 'name' | 'version' | 'manifest'>;

/** A single freeze at least this long disables the addon at once. */
export const LONG_FREEZE_SECONDS = 20;

/**
 * @description Decides whether a freeze disables its addon: its second this session, or one that lasted {@link LONG_FREEZE_SECONDS}.
 * @param count How many times the addon froze Discord this session, this freeze included.
 * @param freeze The freeze the loader reported.
 * @returns Whether to disable the addon.
 */
export function freezeDisables(count: number, freeze: AddonFreeze): boolean {
	return count >= 2 || freeze.seconds >= LONG_FREEZE_SECONDS;
}

/**
 * @description Reports a freeze, logs it and tells the user, saying whether the addon was disabled for it.
 * @param entity The addon that froze Discord.
 * @param freeze The freeze the loader reported.
 * @param count How many times the addon froze Discord this session, this freeze included.
 * @param disabled Whether the addon is disabled for it.
 * @param logger The addon manager's logger.
 */
export function announceFreeze(
	entity: FrozenAddon,
	freeze: AddonFreeze,
	count: number,
	disabled: boolean,
	logger: ReturnType<typeof createLogger>,
): void {
	const seconds = Math.round(freeze.seconds);
	const detail = freeze.detail ? ` ${freeze.detail}` : '';
	const stack = freeze.stack ? `\n${freeze.stack}` : '';

	void reportCrash({
		kind: 'freeze',
		phase: 'frozen',
		addon: crashReportAddon(entity),
		seconds: freeze.seconds,
		...(freeze.detail ? { message: freeze.detail } : {}),
		...(freeze.stack ? { stack: freeze.stack } : {}),
	});
	logger.warn(
		`${entity.name} froze Discord for ${seconds} seconds (freeze ${count} this session).${detail}${stack}`,
	);
	show({
		title: entity.name,
		content: disabled
			? `Disabled ${entity.name} because it froze Discord for ${seconds} seconds.${detail}`
			: `${entity.name} froze Discord for ${seconds} seconds.${detail}`,
	});
}

export default { LONG_FREEZE_SECONDS, freezeDisables, announceFreeze };
