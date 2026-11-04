// `@unbound-app/api/global` also loads the image module declarations, as it does for every plugin.
import type {
	ActionSheetRowIconProps,
	SettingsEntry,
	TableRowIconProps,
	ToastOptions,
} from '@unbound-app/api/global';
import type { RowProps, SwitchRowProps } from '@unbound-app/api/ui';
import { describe, expectTypeOf, test } from 'bun:test';

import type { SvgIconProps } from './fixtures/star.svg';
import type Star from './fixtures/star.svg';

type StarIcon = typeof Star;

type ToastButtonIcon = NonNullable<ToastOptions['buttons']>[number]['icon'];

type ScaledAndTinted = { size: 'xs'; color: string };

type PointsAndWidth = { size: 20; width: 40 };

type OffScale = { size: 'huge' };

// Type-level checks, which `bun run typecheck` runs; at runtime they do nothing.
describe('an imported SVG component', () => {
	test('is an icon component every component-taking icon prop accepts', () => {
		expectTypeOf<StarIcon>().toMatchTypeOf<NonNullable<SettingsEntry['IconComponent']>>();
		expectTypeOf<StarIcon>().toMatchTypeOf<TableRowIconProps['IconComponent']>();
		expectTypeOf<StarIcon>().toMatchTypeOf<ActionSheetRowIconProps['IconComponent']>();
		expectTypeOf<StarIcon>().toMatchTypeOf<RowProps['icon']>();
		expectTypeOf<StarIcon>().toMatchTypeOf<SwitchRowProps['icon']>();
		expectTypeOf<StarIcon>().toMatchTypeOf<ToastOptions['icon']>();
		expectTypeOf<StarIcon>().toMatchTypeOf<ToastButtonIcon>();
	});

	test("takes Discord's icon size scale and theme tokens", () => {
		expectTypeOf<ScaledAndTinted>().toMatchTypeOf<SvgIconProps>();
		expectTypeOf<PointsAndWidth>().toMatchTypeOf<SvgIconProps>();
		expectTypeOf<OffScale>().not.toMatchTypeOf<SvgIconProps>();
	});
});
