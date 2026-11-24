import { Discord } from '@unbound-app/api/metro/components';

import useStyles from '~/components/original-text.style';

type OriginalTextProps = { text: string };

/**
 * @description The message as written, muted under the romanized text, since the dialog's backdrop hides the chat.
 * @param props The message's text.
 * @returns The text.
 */
export default function OriginalText({ text }: OriginalTextProps) {
	const styles = useStyles();

	return (
		<Discord.Text variant='text-sm/medium' color='text-muted' style={styles.text}>
			{text}
		</Discord.Text>
	);
}
