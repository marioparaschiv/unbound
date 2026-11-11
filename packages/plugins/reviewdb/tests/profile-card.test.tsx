import { logs, render, stopPlugin } from '@unbound-app/api/testing';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { type CardProps, startReviewdb } from './helpers/start-reviewdb';

function UserInfo(_: { userId: string }) {
	return null;
}

let card: Awaited<ReturnType<typeof startReviewdb>>;

function renderCard(props: CardProps) {
	return render(<card.default {...props} />, { stores: { User: { getUser: () => undefined } } });
}

beforeEach(async () => {
	card = await startReviewdb();
});
afterEach(stopPlugin);

describe('a user profile card', () => {
	test('gets a View Reviews button under the user info', () => {
		const view = renderCard({ children: [<UserInfo key='info' userId='42' />, 'info'] });

		expect(view.find('Button').props.text).toBe('View Reviews');
	});

	test('stays as Discord drew it when the card has no user info', () => {
		const view = renderCard({ children: ['nothing'] });

		expect(view.findAll('Button')).toEqual([]);
	});

	test('starts without a warning once the profile card patch applies', () => {
		expect(logs.entries.filter(({ level }) => level !== 'info')).toEqual([]);
	});
});
