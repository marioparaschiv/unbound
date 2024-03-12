import { find, findByName, fastFindByProps } from '@metro';

export const Redesign = fastFindByProps('SegmentedControl', 'Stack', { lazy: true });
export const Slider = find(m => m.render?.name === 'SliderComponent');
export const Media = fastFindByProps('openMediaModal', { lazy: true });
export const HelpMessage = findByName('HelpMessage');