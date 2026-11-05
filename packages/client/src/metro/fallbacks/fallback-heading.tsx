import type { DesignModule } from '@unbound-app/types/components';
import type { ComponentProps } from 'react';

import useStyles from './fallback-heading.style';
import FallbackText from './fallback-text';

type TextProps = ComponentProps<DesignModule['Text']>;

/**
 * @description Unbound's stand-in for Discord's `Heading`: bold React Native text.
 * @param props The text props.
 * @returns The heading element.
 */
function FallbackHeading(props: TextProps) {
	const styles = useStyles();

	return <FallbackText {...props} style={[styles.heading, props.style]} />;
}

export default FallbackHeading;
