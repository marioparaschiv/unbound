import type { DesignModule } from '@unbound-app/types/components';
import type { ComponentProps } from 'react';

import FallbackText from './fallback-text';

type TextProps = ComponentProps<DesignModule['Text']>;

/**
 * @description Unbound's stand-in for Discord's `Heading`: bold React Native text.
 * @param props The text props.
 * @returns The heading element.
 */
function FallbackHeading(props: TextProps) {
	return <FallbackText {...props} style={[{ fontWeight: '700' }, props.style]} />;
}

export default FallbackHeading;
