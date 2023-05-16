import { Components } from '@typings/api/metro/components';
import { find, findByName, findByProps } from '@metro';

export const Animated: Components.Animated = findByProps('Value', 'interpolateNode', 'View', { lazy: true });
export const Forms: Components.Forms = findByProps('Form', 'FormSection', { lazy: true });
export const SVG: Components.SVG = findByProps('Svg', 'Path', { lazy: true });
export const Slider = find(m => m.render?.name === 'SliderComponent');
export const Search = findByName('StaticSearchBarContainer');
export const HelpMessage = findByName('HelpMessage');
export const Media = findByProps('openMediaModal');

export const Navigation = findByProps('useNavigation', { lazy: true });