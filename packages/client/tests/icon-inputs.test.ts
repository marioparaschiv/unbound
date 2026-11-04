import { createElement, forwardRef, memo } from 'react';
import { describe, expect, test } from 'bun:test';

import isIconComponent from '~/ui/toasts/is-icon-component';

function Star() {
	return null;
}

describe('isIconComponent', () => {
	test('is true for an icon component, including a memo or forwardRef one', () => {
		expect(isIconComponent(Star)).toBe(true);
		expect(isIconComponent(memo(Star))).toBe(true);
		expect(isIconComponent(forwardRef(Star))).toBe(true);
	});

	test('is false for an element, an asset id or name, an image source, or nothing', () => {
		expect(isIconComponent(createElement(Star))).toBe(false);
		expect(isIconComponent(42)).toBe(false);
		expect(isIconComponent('WrenchIcon')).toBe(false);
		expect(isIconComponent({ uri: 'https://example.com/star.png' })).toBe(false);
		expect(isIconComponent(undefined)).toBe(false);
	});
});
