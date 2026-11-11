import { createMemoryStorage } from '@unbound-app/api/testing/fakes';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

const storage = createMemoryStorage('another-plugin');

mock.module('@unbound-app/api/storage', () => storage);

const { rules } = await import('~/text-replace/stored-rules');

const textReplace = storage.getBucket('unbound.text-replace');

beforeEach(() => textReplace.clear());

describe('rules', () => {
	test("reads Text Replace's rules from any plugin, giving each one an id", () => {
		textReplace.set('stringRules', [{ find: 'teh', replace: 'the' }]);
		textReplace.set('regexRules', [{ find: '/a+/', replace: 'a', onlyIfIncludes: 'b' }]);

		const { stringRules, regexRules } = rules();

		expect(stringRules).toEqual([
			{ find: 'teh', replace: 'the', onlyIfIncludes: '', id: expect.any(String) },
		]);
		expect(regexRules).toEqual([
			{ find: '/a+/', replace: 'a', onlyIfIncludes: 'b', id: expect.any(String) },
		]);
	});

	test('leaves out the blank rule an empty list is stored as, and lists Text Replace never wrote', () => {
		textReplace.set('stringRules', [
			{ id: 'blank', find: '', replace: '', onlyIfIncludes: '' },
		]);

		expect(rules()).toEqual({ stringRules: [], regexRules: [] });
	});
});
