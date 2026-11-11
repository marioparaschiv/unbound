import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import {
	INSTALL_QUESTIONS,
	findInstallChoices,
	isInstallQuestion,
	type InstallResultId,
} from '~/lib/guides/install-quiz';

const INSTALLING = join(import.meta.dir, '../../../../../docs/user/installing.mdx');

const RESULT_ID = /<InstallResult id='([^']+)'/g;

function listResultIds(): InstallResultId[] {
	return Object.values(INSTALL_QUESTIONS).flatMap((question) =>
		question.answers.flatMap((answer) => (isInstallQuestion(answer.next) ? [] : [answer.next])),
	);
}

describe('install quiz', () => {
	test('the installing guide has steps for exactly the paths the quiz ends on', async () => {
		const source = await Bun.file(INSTALLING).text();
		const written = [...source.matchAll(RESULT_ID)].flatMap(([, id]) => id ?? []);

		const byId = (left: string, right: string) => left.localeCompare(right);

		expect(written.toSorted(byId)).toEqual(listResultIds().toSorted(byId));
	});

	test('every path is reachable from the first question', () => {
		for (const id of listResultIds()) {
			expect(findInstallChoices(id)?.at(-1)?.answer.next).toBe(id);
		}
	});

	test('a hash that names no path opens the first question', () => {
		expect(findInstallChoices('after-installing')).toBeUndefined();
	});
});
