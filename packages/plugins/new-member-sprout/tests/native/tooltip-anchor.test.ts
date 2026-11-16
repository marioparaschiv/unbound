import { expect, test } from 'bun:test';

import { anchorAround } from '~/native/tooltip-anchor';

test('centers a sprout-sized anchor on the tap', () => {
	expect(anchorAround({ x: 146, y: 170 })).toEqual({ x: 136, y: 160, width: 20, height: 20 });
});
