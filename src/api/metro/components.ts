import { Components } from '@typings/api/metro/components';
import { findByName, findByProps } from '@metro';

export const Native = findByProps('Button', 'View', 'Text', { lazy: true });
export const Forms: Components.Forms = findByProps('Form', 'FormSection', { lazy: true });
export const SVG: Components.SVG = findByProps('Svg', 'Path', { lazy: true });
export const Search = findByName('StaticSearchBarContainer');
export const Media = findByProps('openMediaModal');

export const Navigation = findByProps('useNavigation', { lazy: true });