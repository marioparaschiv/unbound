import { render, stopPlugin } from '@unbound-app/api/testing';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { card, type CardProps, startReviewdb } from './start-reviewdb';

function UserInfo(_: { userId: string }) {
	return null;
}

function renderCard(props: CardProps) {
	return render(<card.default {...props} />, { stores: { User: { getUser: () => undefined } } });
}

beforeEach(startReviewdb);
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
});
