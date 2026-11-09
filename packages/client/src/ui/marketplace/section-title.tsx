import { Discord } from '~/metro/components';

import useStyles from './section-title.style';

type SectionTitleProps = {
	children: string;
};

/** @description A marketplace tab's section heading, such as Featured or All Plugins. */
function SectionTitle({ children }: SectionTitleProps) {
	const styles = useStyles();

	return (
		<Discord.Text variant='heading-md/bold' style={styles.title} accessibilityRole='header'>
			{children}
		</Discord.Text>
	);
}

export default SectionTitle;
