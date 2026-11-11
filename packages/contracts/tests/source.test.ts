import { describe, expect, test } from 'bun:test';

import { parseRepository, repositoryInputSchema } from '~/source';
import { parse, safeParse } from '~/schema';

describe('parseRepository', () => {
	test('reads every form a user pastes or git prints', () => {
		const cases: [string, ReturnType<typeof parseRepository>][] = [
			['acme/addons', { repository: 'acme/addons' }],
			['  acme/addons.git ', { repository: 'acme/addons' }],
			['https://github.com/acme/addons', { repository: 'acme/addons' }],
			['https://github.com/acme/addons.git', { repository: 'acme/addons' }],
			['http://www.github.com/acme/addons/', { repository: 'acme/addons' }],
			['github.com/acme/my.addons', { repository: 'acme/my.addons' }],
			['git@github.com:acme/addons.git', { repository: 'acme/addons' }],
			['ssh://git@github.com/acme/addons.git', { repository: 'acme/addons' }],
			[
				'https://github.com/acme/addons/tree/v1.2.0',
				{ repository: 'acme/addons', ref: 'v1.2.0' },
			],
			[
				'https://github.com/acme/addons/tree/main/plugins/hello%20world/',
				{ repository: 'acme/addons', ref: 'main', path: 'plugins/hello world' },
			],
		];

		for (const [input, expected] of cases) {
			expect({ input, parsed: parseRepository(input) }).toEqual({ input, parsed: expected });
		}
	});

	test('refuses anything that is not a GitHub repository', () => {
		const inputs = [
			'',
			'acme',
			'acme/addons/extra',
			'-acme/addons',
			'acme/..',
			'https://gitlab.com/acme/addons',
			'https://github.com/acme',
			'https://github.com/acme/addons/blob/main/README.md',
			'git@gitlab.com:acme/addons.git',
		];

		for (const input of inputs) {
			expect({ input, parsed: parseRepository(input) }).toEqual({ input, parsed: undefined });
		}
	});
});

describe('repositoryInputSchema', () => {
	test('outputs owner/name and explains a refusal', () => {
		expect(parse(repositoryInputSchema, 'https://github.com/acme/addons.git')).toBe(
			'acme/addons',
		);

		const result = safeParse(repositoryInputSchema, 'https://gitlab.com/acme/addons');

		expect(result.success).toBe(false);
		expect(result.success ? [] : result.error.issues).toHaveLength(1);
		expect(result.success ? '' : (result.error.issues[0]?.message ?? '')).toBeTruthy();
	});
});
