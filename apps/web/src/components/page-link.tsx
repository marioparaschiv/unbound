import type { LinkProps } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { Button } from '~/components/ui/button';

type PageLinkProps = {
	/** The search of the page to go to on the current route; `null` when there is no such page. */
	search: LinkProps['search'] | null;
	children: ReactNode;
};

function PageLink({ search, children }: PageLinkProps) {
	if (search === null) {
		return (
			<Button variant='outline' size='sm' disabled>
				{children}
			</Button>
		);
	}

	return (
		<Button asChild variant='outline' size='sm'>
			<Link to='.' search={search}>
				{children}
			</Link>
		</Button>
	);
}

export type { PageLinkProps };

export default PageLink;
