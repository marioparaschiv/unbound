import type { BackgroundJob } from '@unbound-app/types/background';

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
		add: (name: string, job: BackgroundJob) =>
			subscriptions.add(background.add(name, job, owner)),
		run: background.run,
		status: background.status,
	};
}

export default { scopeBackground };
