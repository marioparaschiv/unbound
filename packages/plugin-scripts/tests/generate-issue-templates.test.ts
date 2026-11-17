import { describe, expect, test } from 'bun:test';

import { withPluginOptions } from '../src/generate-issue-templates';

const FORM = [
	'body:',
	'    - type: dropdown',
	'      id: plugin',
	'      attributes:',
	'          label: Plugin',
	'          options:',
	'              - Not a plugin',
	'              - Old Plugin',
	'      validations:',
	'          required: true',
].join('\n');

describe('withPluginOptions', () => {
	test('keeps the first option and lists every plugin by name', () => {
		expect(withPluginOptions(FORM, ['Zeta', 'Alpha', 'Alpha'])).toBe(
			FORM.replace(
				'              - Old Plugin',
				'              - Alpha\n              - Zeta',
			),
		);
	});

	test('leaves a form without a plugin dropdown alone', () => {
		expect(withPluginOptions('body: []', ['Alpha'])).toBe('body: []');
	});
});
