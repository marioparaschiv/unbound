import { Components } from '@typings/api/metro/components';
import { find, findByName, findByProps } from '@metro';

export const Forms = findByProps('Form', 'FormSection', { lazy: true }) as Components.Forms;
export const SVG = findByProps('Svg', 'Path', { lazy: true }) as Components.SVG;
export const Slider = find(m => m.render?.name === 'SliderComponent');
export const Search = findByName('StaticSearchBarContainer');
export const HelpMessage = findByName('HelpMessage');
export const Media = findByProps('openMediaModal', { lazy: true });
export const { default: Button } = findByProps('ButtonColors', 'ButtonLooks', 'ButtonSizes', { lazy: true });
export const Redesign = findByProps('SegmentedControl', 'Stack', { lazy: true });

export const Navigation = findByProps('useNavigation', { lazy: true });