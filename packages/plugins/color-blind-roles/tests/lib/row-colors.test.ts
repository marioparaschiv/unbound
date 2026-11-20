import { describe, expect, test } from 'bun:test';

import { adjustRowColors } from '~/lib/row-colors';

const plusOne = (argb: number) => argb + 1;

describe('adjustRowColors', () => {
	test('adjusts the name colors and role gradients', () => {
		const message: Record<string, unknown> = {
			roleColor: 10,
			usernameColor: 20,
			colorString: null,
			roleColors: { primaryColor: 30, secondaryColor: null },
		};

		adjustRowColors(message, plusOne, false);

		expect(message).toEqual({
			roleColor: 11,
			usernameColor: 21,
			colorString: null,
			roleColors: { primaryColor: 31, secondaryColor: null },
		});
	});

	test('adjusts role mentions, nested or not, and leaves user mentions alone', () => {
		const role = { type: 'mention', roleId: '1', roleColor: 5, color: '#000001' };
		const user = { type: 'mention', userId: '2', color: 7 };
		const message: Record<string, unknown> = {
			content: [{ type: 'strong', content: [role] }, user],
		};

		adjustRowColors(message, plusOne, true);

		expect(role).toEqual({ type: 'mention', roleId: '1', roleColor: 6, color: '#000002' });
		expect(user.color).toBe(7);
	});

	test('adjusts users and names in content that carry their role color', () => {
		const user = {
			type: 'mention',
			userId: '2',
			roleColor: 7,
			roleColors: { primaryColor: 8 },
		};
		const name = { action: 'bindUserMenu', userId: '3', roleColor: 9, linkColor: 4 };

		adjustRowColors({ content: [user, { type: 'text', content: [name] }] }, plusOne, true);

		expect(user).toEqual({
			type: 'mention',
			userId: '2',
			roleColor: 8,
			roleColors: { primaryColor: 9 },
		});
		expect(name).toEqual({ action: 'bindUserMenu', userId: '3', roleColor: 10, linkColor: 4 });
	});

	test('adjusts the replied-to message as well', () => {
		const reply: Record<string, unknown> = { roleColor: 1, usernameColor: 2 };

		adjustRowColors({ referencedMessage: { state: 0, message: reply } }, plusOne, true);

		expect(reply).toEqual({ roleColor: 2, usernameColor: 3 });
	});

	test('leaves mentions alone when asked', () => {
		const role = { type: 'mention', roleId: '1', roleColor: 5 };

		adjustRowColors({ content: [role] }, plusOne, false);

		expect(role.roleColor).toBe(5);
	});
});
