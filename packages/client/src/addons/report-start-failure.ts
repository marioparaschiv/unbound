import { crashReportAddon } from '~/diagnostics/crash-report';
import { reportCrash } from '~/diagnostics/crash-reports';
import { afterFirstFrame } from '~/core/first-frame';
import type { Addon } from '~/addons/addon';

/**
 * @description Reports an addon that failed to start once Discord has drawn a frame. A runtime the loader reloads
 * before it draws (a bundle update at launch) still starts addons after its native modules are gone, so it never sends.
 * @param addon The addon that failed.
 * @param failure Why it failed.
 * @param phase Whether it failed while starting or once running.
 */
export function reportStartFailure(
	addon: Pick<Addon, 'id' | 'version' | 'manifest'>,
	failure: Error,
	phase: 'starting' | 'running',
): void {
	afterFirstFrame(
		() =>
			void reportCrash({
				kind: 'start-failure',
				phase,
				addon: crashReportAddon(addon),
				message: failure.message,
				stack: failure.stack,
			}),
	);
}

export default reportStartFailure;
