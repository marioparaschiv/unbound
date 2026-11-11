import type { ReactNode } from 'react';

import { Discord } from '~/metro/components';

import useStyles from './page-card.style';

type PageCardProps = {
	title: string;
	children: ReactNode;
};

/** @description A titled card on a addon page, like the website's sidebar cards. */
function PageCard({ title, children }: PageCardProps) {
	const styles = useStyles();

	return (
		<Discord.Card variant='primary' border='subtle' style={styles.card}>
			<Discord.Text variant='heading-md/bold' style={styles.title} accessibilityRole='header'>
				{title}
			</Discord.Text>
			{children}
		</Discord.Card>
	);
}

export default PageCard;
