import { find, findByName, findByProps } from '@metro';

export const Redesign = findByProps('SegmentedControl', 'Stack', { lazy: true });
export const Slider = find(m => m.render?.name === 'SliderComponent');
export const Media = findByProps('openMediaModal', { lazy: true });
export const HelpMessage = findByName('HelpMessage');