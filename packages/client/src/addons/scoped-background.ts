import type { BackgroundJob, BackgroundJobOptions } from '@unbound-app/types/background';

import { addBackgroundJob, DEFAULT_PHASE } from '~/background/jobs';
import type { Subscriptions } from '~/addons/subscriptions';
import * as background from '~/background/api';

/**
 * @description Creates a plugin's `background` namespace, whose jobs carry the plugin's id and are removed on dispose.
 * @param subscriptions The plugin's subscription tracker.
 * @param owner The plugin's id.
 * @returns The namespace.
 */
export function scopeBackground(
	subscriptions: Subscriptions,
	owner: string,
): Omit<typeof background, 'default'> {
	return {
		add: (name: string, job: BackgroundJob, options?: BackgroundJobOptions) =>
			subscriptions.add(
				addBackgroundJob({ ...options, name, owner, run: job, phase: DEFAULT_PHASE }),
			),
		run: background.run,
		status: background.status,
	};
}

export default { scopeBackground };
