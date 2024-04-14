import { find, findByName, fastFindByProps } from '@metro';
import type { Module } from '@typings/api/metro';

function fastFindExtended<T extends string>(prop: T) {
	return fastFindByProps(prop, { all: true })
		.find(mdl => Object.getOwnPropertyDescriptor(mdl, prop)?.value && !mdl.ScrollView && !mdl.Text && mdl[prop].render);
}

// These components require further filtering when fetching via fastFindByProps
const RenderPartialProps = [
	'Button',
	'TextInput',
	'IconButton'
] as const;

const BasicPartialProps = [
	'openAlert',
	'AlertModal',
	'AlertActionButton',
	'Navigator',
	'Backdrop',
	'useNavigation',
	'dismissAlerts',
	'TableRowGroup',
	'ContextMenu',
	'TableRow',
	'TableSwitchRow',
	'TableRowIcon',
	'TableRowDivider',
	'SegmentedControlPages',
	'SegmentedControl',
	'RowButton',
	'Card',
	'Pile',
	'PileOverflow',
	'Tabs',
	'useSegmentedControlState'
] as const;

const RenderPartial = RenderPartialProps
	.reduce((prev, cur) => ({ ...prev, [cur]: fastFindExtended(cur)[cur] }), {});

const BasicPartial = BasicPartialProps
	.reduce((prev, cur) => ({ ...prev, [cur]: fastFindByProps(cur)[cur] }), {});

export const Redesign = new Proxy({} as Module<typeof RenderPartialProps[number] | typeof BasicPartialProps[number]>, {
	get(_, prop: string, __) {
		return RenderPartial[prop] ?? BasicPartial[prop] ?? fastFindByProps(prop)[prop];
	}
});

export const Slider = find(m => m.render?.name === 'SliderComponent');
export const Media = fastFindByProps('openMediaModal', { lazy: true });
export const HelpMessage = findByName('HelpMessage');