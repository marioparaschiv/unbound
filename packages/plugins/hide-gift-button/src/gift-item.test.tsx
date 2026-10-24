import { Children, createElement, isValidElement, type ReactElement } from 'react';
import { expect, test } from 'bun:test';

import { withoutGiftItem } from './gift-item';

function TransitionItem() {
	return null;
}

function Expression() {
	return null;
}

function actions(...children: ReactElement[]) {
	return createElement('View', null, ...children);
}

test('removes the gift slot and keeps the other actions', () => {
	const gift = createElement(TransitionItem, { renderItem: () => null });
	const result = withoutGiftItem(actions(gift, createElement(Expression)));
	const types = Children.toArray(result?.props.children).map((child) =>
		isValidElement(child) ? child.type : child,
	);

	expect(types).toEqual([Expression]);
});

test('returns nothing when there is no gift slot', () => {
	const plain = createElement(TransitionItem);

	expect(withoutGiftItem(actions(plain, createElement(Expression)))).toBeUndefined();
});
