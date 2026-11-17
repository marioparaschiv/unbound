import { describe, expect, test } from 'bun:test';

import { planCrashWithdrawal } from '~/lib/crash-issues/crash-withdrawal';

describe('planCrashWithdrawal', () => {
	test('falls back from the served version to the newest other live one', () => {
		const versions = [
			{ version: '1.3.0', withdrawnBy: null },
			{ version: '1.2.0', withdrawnBy: 4 },
			{ version: '1.1.0', withdrawnBy: null },
		];

		expect(planCrashWithdrawal(versions, '1.3.0')).toEqual({ from: '1.3.0', to: '1.1.0' });
	});

	test('withdraws an older live version without changing what is served', () => {
		const versions = [
			{ version: '1.3.0', withdrawnBy: null },
			{ version: '1.1.0', withdrawnBy: null },
		];

		expect(planCrashWithdrawal(versions, '1.1.0')).toEqual({ from: '1.3.0', to: '1.3.0' });
	});

	test('leaves the only live version, and versions already withdrawn, alone', () => {
		expect(
			planCrashWithdrawal([{ version: '1.0.0', withdrawnBy: null }], '1.0.0'),
		).toBeUndefined();
		expect(
			planCrashWithdrawal(
				[
					{ version: '1.1.0', withdrawnBy: 3 },
					{ version: '1.0.0', withdrawnBy: null },
				],
				'1.1.0',
			),
		).toBeUndefined();
	});
});
