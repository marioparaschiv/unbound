import { logs, render, stopPlugin } from '@unbound-app/api/testing';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { type AboutCardProps, startReviewdb } from './helpers/start-reviewdb';

let card: Awaited<ReturnType<typeof startReviewdb>>;

function renderCard(props: AboutCardProps) {
	return render(<card.default {...props} />, { stores: { User: { getUser: () => undefined } } });
}

beforeEach(async () => {
	card = await startReviewdb();
});
afterEach(stopPlugin);

describe('a profile About card', () => {
	test('gets a Reviews section before the policy links', () => {
		const view = renderCard({ userId: '42' });
		const texts = view.findAll('Text').map((text) => text.props.children);

		expect(texts).toEqual(['bio', 'Reviews', 'View reviews', 'policy']);
	});

	test('stays as Discord drew it without a user', () => {
		const view = renderCard({});

		expect(view.findAll('Text').map((text) => text.props.children)).toEqual(['bio', 'policy']);
	});

	test('starts without a warning once the About card patch applies', () => {
		expect(logs.entries.filter(({ level }) => level !== 'info')).toEqual([]);
	});
});
