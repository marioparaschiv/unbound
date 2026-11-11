import { describe, expect, test } from 'bun:test';
import type { ComponentProps } from 'react';

import type { Discord } from '~/metro/design';

// JSX against Discord's generated components, loosened by `LooseProps`. Only type-checked: nothing renders.
type DiscordComponents = typeof Discord;

type SwitchRow = DiscordComponents['TableSwitchRow'];

function elements(Row: SwitchRow) {
	return [
		// A prop the generator never saw, and none of the "required" ones.
		<Row key='unknown' someNewProp />,
		<Row key='known' label='Label' value onValueChange={(value: boolean) => value} />,
		// @ts-expect-error `value` is a boolean
		<Row key='wrong' value={1} />,
		// A prop typed as a React node or object accepts anything.
		<Row key='weak' label={{ not: 'a node' }} trailing={1} />,
	];
}

describe('loose component props', () => {
	test('known props stay suggested on the props type', () => {
		const props: ComponentProps<SwitchRow> = { value: true, label: 'Label' };

		expect(props.value).toBe(true);
		expect(elements).toBeInstanceOf(Function);
	});
});
