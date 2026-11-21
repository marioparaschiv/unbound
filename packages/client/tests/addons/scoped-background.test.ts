import { describe, expect, test } from 'bun:test';

import { scopeBackground } from '~/addons/scoped-background';
import { createSubscriptions } from '~/addons/subscriptions';
import { status } from '~/background/api';

describe('a plugin background namespace', () => {
	test('tags jobs with the plugin id and removes them on dispose', () => {
		const subscriptions = createSubscriptions();
		const background = scopeBackground(subscriptions, 'a.plugin');

		background.add('mentions', () => {});

		expect(status().jobs).toEqual([{ name: 'mentions', owner: 'a.plugin' }]);

		subscriptions.dispose();

		expect(status().jobs).toEqual([]);
	});
});
