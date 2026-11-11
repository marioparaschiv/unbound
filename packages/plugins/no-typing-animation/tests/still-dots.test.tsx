import { flux, logs, metro, render, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { View } from 'react-native';

function AnimatedEllipsisDot(_props: { delay: number }) {
	return <View />;
}

function EllipsisDot(_props: { delay: number }) {
	return <View />;
}

function makeEllipsis(Dot: typeof AnimatedEllipsisDot) {
	return function Ellipsis() {
		return (
			<View>
				{[0, 1, 2].map((index) => createElement(Dot, { key: index, delay: index * 233 }))}
			</View>
		);
	};
}

async function renderDots(Dot: typeof AnimatedEllipsisDot) {
	const module = { default: makeEllipsis(Dot) };

	metro.register(module, 'design/void/Ellipsis/native/Ellipsis.tsx');
	metro.register({ colors: { TEXT_DEFAULT: '#fff' }, internal: {} });
	await startPlugin();

	return render(<module.default />);
}

beforeEach(() => {
	flux.seed({ Typing: { emitChange: () => undefined } });
});

describe('the typing dots', () => {
	test('are drawn as three still dots', async () => {
		const view = await renderDots(AnimatedEllipsisDot);

		expect(view.findAll('AnimatedEllipsisDot')).toEqual([]);
		expect(view.findAll('View').length).toBe(4);
		expect(view.findAll('View')[1]?.props.style).toMatchObject([
			{ opacity: 0.4, width: 6 },
			undefined,
		]);
	});

	test('keep Discord’s own dots when Reduce Motion already made them still', async () => {
		const view = await renderDots(EllipsisDot);

		expect(view.findAll('EllipsisDot').length).toBe(3);
	});

	test('start without a warning, so the self test passes', async () => {
		await renderDots(AnimatedEllipsisDot);

		expect(logs.entries.filter((entry) => entry.level === 'warn')).toEqual([]);
	});

	test('are skipped with one warning when Discord moved Ellipsis', async () => {
		metro.markMissing('design/void/Ellipsis/native/Ellipsis.tsx');
		await startPlugin();

		expect(logs.entries).toContainEqual({
			level: 'warn',
			args: ['Still dots skipped: Discord moved Ellipsis.'],
		});
	});
});
