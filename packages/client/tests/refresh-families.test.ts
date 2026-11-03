import { beforeEach, describe, expect, test } from 'bun:test';

import { getFamilyByID, performReactRefresh, register, setSignature } from '~/hot-refresh/families';

const MEMO = Symbol.for('react.memo');
const FORWARD_REF = Symbol.for('react.forward_ref');

function nextRun(id: string, type: () => string, signature?: string) {
	register(type, id);

	if (signature !== void 0) {
		setSignature(type, signature);
	}
}

// The families table lives for the whole run of the module, so a test starts by dropping what the last one left.
beforeEach(() => {
	performReactRefresh();
});

describe('refresh families', () => {
	test('renders the latest run of a component, keeping one family per id', () => {
		const first = () => 'first';
		const second = () => 'second';

		nextRun('families.rerun Card', first);

		expect(getFamilyByID('families.rerun Card')?.current).toBe(first);

		nextRun('families.rerun Card', second);

		expect(getFamilyByID('families.rerun Card')?.current).toBe(first);

		performReactRefresh();

		expect(getFamilyByID('families.rerun Card')?.current).toBe(second);
	});

	test('re-renders in place while the hook order is unchanged', () => {
		const first = () => 'first';
		const second = () => 'second';

		nextRun('families.same Card', first, 'hooks');
		nextRun('families.same Card', second, 'hooks');

		const update = performReactRefresh();

		expect(update?.updatedFamilies.size).toBe(1);
		expect(update?.staleFamilies.size).toBe(0);
	});

	test('needs a remount once the hook order changed', () => {
		const first = () => 'first';
		const second = () => 'second';

		nextRun('families.changed Card', first, 'one');
		nextRun('families.changed Card', second, 'two');

		const update = performReactRefresh();

		expect(update?.updatedFamilies.size).toBe(0);
		expect(update?.staleFamilies.size).toBe(1);
		expect(getFamilyByID('families.changed Card')?.current).toBe(second);
	});

	test('needs a remount when a memo run stops comparing props', () => {
		const type = () => 'type';
		const compared = { $$typeof: MEMO, type, compare: () => true };
		const uncompared = { $$typeof: MEMO, type, compare: null };

		register(compared, 'families.memo Card');
		register(uncompared, 'families.memo Card');

		expect(performReactRefresh()?.staleFamilies.size).toBe(1);
	});

	test('registers the inner component of a memo and of a forwardRef', () => {
		const type = () => 'type';
		const render = () => 'render';
		const memo = { $$typeof: MEMO, type, compare: null };
		const forwardRef = { $$typeof: FORWARD_REF, render };

		register(memo, 'families.wrapped Memo');
		register(forwardRef, 'families.wrapped Forward');

		expect(getFamilyByID('families.wrapped Memo$type')?.current).toBe(type);
		expect(getFamilyByID('families.wrapped Forward$render')?.current).toBe(render);
	});

	test('reports nothing to do when no module ran again', () => {
		register(() => 'once', 'families.once Card');
		performReactRefresh();

		expect(performReactRefresh()).toBeNull();
	});
});
