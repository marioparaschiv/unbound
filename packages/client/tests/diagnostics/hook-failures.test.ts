import { describe, expect, test } from 'bun:test';

import { hookFailures, hookTarget, recordHookFailure } from '~/diagnostics/hook-failures';

describe('hookTarget', () => {
	test('names a Java method with its signature', () => {
		expect(hookTarget('android.widget.TextView', 'setText', ['java.lang.CharSequence'])).toBe(
			'android.widget.TextView.setText(java.lang.CharSequence)',
		);
	});

	test('names Objective-C instance and class selectors', () => {
		expect(hookTarget('UILabel', 'setText:')).toBe('UILabel -setText:');
		expect(hookTarget('DCDTheme', '+currentTheme')).toBe('DCDTheme +currentTheme');
	});
});

describe('recordHookFailure', () => {
	test('keeps the newest five, with the plugin and reason', () => {
		for (let index = 0; index < 7; index++) {
			recordHookFailure('adrian.test', `Cell -method${index}`, new Error(`bad ${index}`));
		}

		const failures = hookFailures();

		expect(failures).toHaveLength(5);
		expect(failures[0]).toEqual({
			addon: 'adrian.test',
			target: 'Cell -method2',
			reason: 'bad 2',
		});
		expect(failures.at(-1)?.target).toBe('Cell -method6');
	});
});
