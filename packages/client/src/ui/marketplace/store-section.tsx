import type { ReactNode } from 'react';

import { Discord } from '~/metro/components';

import useStyles from './store-section.style';

type StoreSectionProps = {
	title: string;
	children: ReactNode;
};

/** @description A titled card on a store page, like the website's sidebar cards. */
function StoreSection({ title, children }: StoreSectionProps) {
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

export default StoreSection;
