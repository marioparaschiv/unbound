import { find, findByName, fastFindByProps } from '@metro';

export const Redesign = fastFindByProps('Stack', 'TableRow') ?? new Proxy({}, {
	get(_, prop, __) {
		return fastFindByProps(prop as string)[prop];
	}
}) as Record<string, any>;

export const Slider = find(m => m.render?.name === 'SliderComponent');
export const Media = fastFindByProps('openMediaModal', { lazy: true });
export const HelpMessage = findByName('HelpMessage');