import {
	featureSelfTest,
	recordApplied,
	resetHealth,
} from '@unbound-plugins/shared/lifecycle/health';
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { skip } from '~/skip';

describe('skip', () => {
	afterEach(() => resetHealth());

	test('fails the self test even when other features applied', () => {
		const log = spyOn(console, 'error').mockImplementation(() => {});

		recordApplied(3);
		skip('the member list, UserRow is not a component');

		expect(featureSelfTest()).toEqual({
			ok: false,
			detail: 'skipped: the member list, UserRow is not a component',
		});
		expect(log).toHaveBeenCalledWith(
			'[Platform Indicators] Skipped the member list, UserRow is not a component.',
		);

		log.mockRestore();
	});
});
