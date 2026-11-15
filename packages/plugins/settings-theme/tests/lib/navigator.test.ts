import { createElement, type ReactNode } from 'react';
import { describe, expect, test } from 'bun:test';

import { transparentOptions, withTransparentNavigator } from '~/lib/navigator';

const TRANSPARENT = { backgroundColor: 'transparent' };
const Navigator = () => null;
const Screen = () => null;

describe('transparent settings screens', () => {
	test('keeps options and clears the content and header backgrounds', () => {
		expect(transparentOptions({ title: 'A' })).toEqual({
			title: 'A',
			contentStyle: TRANSPARENT,
			headerStyle: TRANSPARENT,
			headerTransparent: true,
		});

		const options = transparentOptions(() => ({
			title: 'B',
			contentStyle: { backgroundColor: 'black' },
			headerStyle: { height: 40, backgroundColor: 'black' },
		}));

		expect(typeof options === 'function' ? options() : options).toEqual({
			title: 'B',
			contentStyle: TRANSPARENT,
			headerStyle: { height: 40, ...TRANSPARENT },
			headerTransparent: true,
		});
	});

	test('changes the navigator with the id, its screens and the views around it', () => {
		const tree = createElement(
			'View',
			{ style: { backgroundColor: 'grey' } },
			createElement(
				Navigator,
				{ id: 'settings-navigator', screenOptions: { title: 'x' } },
				createElement(Screen, { name: 'Overview', options: { title: 'y' } }),
			),
		);
		const layout = ({ children }: { children: ReactNode }) =>
			createElement('Themed', null, children);
		const changed = withTransparentNavigator(
			tree,
			'settings-navigator',
			layout as never,
		) as any;
		const navigator = changed.props.children;

		expect(changed.props.style).toEqual([{ backgroundColor: 'grey' }, TRANSPARENT]);
		expect(navigator.props.screenOptions.contentStyle).toEqual(TRANSPARENT);
		expect(navigator.props.children.props.options.contentStyle).toEqual(TRANSPARENT);
		expect(navigator.props.screenLayout({ children: 'page' })).toEqual(
			createElement('Themed', null, 'page'),
		);
	});

	test('keeps a layout the navigator already had inside the new one', () => {
		const own = ({ children }: { children: ReactNode }) => createElement('Own', null, children);
		const tree = createElement(Navigator, { id: 'settings-navigator', screenLayout: own });
		const layout = ({ children }: { children: ReactNode }) =>
			createElement('Themed', null, children);
		const changed = withTransparentNavigator(
			tree,
			'settings-navigator',
			layout as never,
		) as any;

		expect(changed.props.screenLayout({ children: 'page' })).toEqual(
			createElement('Themed', null, createElement('Own', null, 'page')),
		);
	});
});
