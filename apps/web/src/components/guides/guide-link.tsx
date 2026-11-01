import { Link } from '@tanstack/react-router';
import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

type GuideLinkProps = ComponentProps<'a'>;

export const GUIDE_LINK_CLASS = 'font-medium text-link underline-offset-4 hover:underline';

/**
 * @description A link in a guide: site paths go through the router, anchors stay on the page, and
 * everything else opens in a new tab.
 * @param props The anchor's props.
 * @returns The link.
 */
function GuideLink({ href = '', className, children, ...props }: GuideLinkProps) {
	const classes = cn(GUIDE_LINK_CLASS, className);

	if (href.startsWith('/')) {
		const [path, hash] = href.split('#');

		return (
			<Link to={path} hash={hash} className={classes} {...props}>
				{children}
			</Link>
		);
	}

	if (href.startsWith('#')) {
		return (
			<a href={href} className={classes} {...props}>
				{children}
			</a>
		);
	}

	return (
		<a href={href} target='_blank' rel='noopener noreferrer' className={classes} {...props}>
			{children}
		</a>
	);
}

export default GuideLink;
