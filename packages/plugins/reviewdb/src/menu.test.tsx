import { expect, mock, test } from 'bun:test';

const profileModule = { default: () => null };
const lookups: string[] = [];
const patches: unknown[] = [];

mock.module('@unbound-app/api', () => ({
	metro: {
		findByFilePath(path: string) {
			lookups.push(path);
			return profileModule;
		},
		findByName(name: string) {
			lookups.push(name);
			return null;
		},
	},
	patcher: {
		createPatcher: () => ({
			after(target: unknown) {
				patches.push(target);
			},
			unpatchAll() {},
		}),
	},
}));

mock.module('@reviewdb/sheets/ReviewsSheet', () => ({ openReviewsSheet() {} }));

const { startReviewMenuPatch } = await import('./menu');

test('patches the anonymous Discord profile card by its module path', () => {
	startReviewMenuPatch();

	expect(lookups).toEqual(['modules/user_profile/native/UserProfileCard.tsx']);
	expect(patches).toEqual([profileModule]);
});
