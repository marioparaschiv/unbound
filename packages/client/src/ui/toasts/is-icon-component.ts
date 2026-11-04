import type { DiscordIconProps } from '@unbound-app/types/components';
import type { ComponentType } from 'react';
import { isValidElement } from 'react';

/**
 * @description Tells an icon component apart from an asset name or id, an image source or an element.
 * @param icon A toast's or button's icon.
 * @returns Whether it is a function component or a `memo` or `forwardRef` object.
 */
// UNKNOWN: a toast icon is any of several shapes, and may be absent.
export default function isIconComponent(icon: unknown): icon is ComponentType<DiscordIconProps> {
	if (typeof icon === 'function') {
		return true;
	}

	return typeof icon === 'object' && icon !== null && '$$typeof' in icon && !isValidElement(icon);
}
