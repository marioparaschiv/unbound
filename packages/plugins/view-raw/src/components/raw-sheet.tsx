import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { TextInput, View, type TextStyle } from 'react-native';

import useStyles from '~/components/raw-sheet.style';
import type { RawItem } from '~/lib/raw-items';
import { typeName } from '~/lib/type-name';

type RawSheetProps = {
	type: RawItem['type'];
	json: string;
	content: string;
	onCopy: (value: string, message: string) => void;
	onClose: () => void;
};

type SheetButtonProps = {
	label: string;
	variant?: 'primary' | 'secondary';
	onPress: () => void;
};

type CodeFieldProps = {
	value: string;
	style: TextStyle;
};

function SheetButton({ label, variant = 'secondary', onPress }: SheetButtonProps) {
	const styles = useStyles();

	return (
		<View style={styles.button}>
			<Discord.Button text={label} variant={variant} size='sm' onPress={onPress} />
		</View>
	);
}

function CodeField({ value, style }: CodeFieldProps) {
	const styles = useStyles();

	return (
		<TextInput
			multiline
			scrollEnabled
			selectTextOnFocus
			showSoftInputOnFocus={false}
			style={[styles.code, style]}
			value={value}
		/>
	);
}

function RawSheet({ type, json, content, onCopy, onClose }: RawSheetProps) {
	const styles = useStyles();

	return (
		<Discord.ActionSheet startExpanded>
			<Discord.BottomSheetTitleHeader title={format('RAW_TITLE', { type: typeName(type) })} />
			<View style={styles.container}>
				{content ? (
					<>
						<Discord.Text variant='text-sm/semibold' color='text-strong'>
							{messages.MESSAGE_CONTENT}
						</Discord.Text>
						<CodeField value={content} style={styles.content} />
						<Discord.Text
							variant='text-sm/semibold'
							color='text-strong'
							style={styles.heading}
						>
							{messages.MESSAGE_DATA}
						</Discord.Text>
					</>
				) : null}
				<CodeField value={json} style={styles.data} />
				<View style={styles.buttons}>
					<SheetButton
						label={messages.COPY_DATA}
						variant='primary'
						onPress={() =>
							onCopy(json, format('DATA_COPIED', { type: typeName(type) }))
						}
					/>
					{content ? (
						<SheetButton
							label={messages.COPY_CONTENT}
							onPress={() => onCopy(content, messages.CONTENT_COPIED)}
						/>
					) : null}
					<SheetButton label={messages.CLOSE} onPress={onClose} />
				</View>
			</View>
		</Discord.ActionSheet>
	);
}

export default RawSheet;
