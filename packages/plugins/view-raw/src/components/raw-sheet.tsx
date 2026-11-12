import { Pressable, Text, TextInput, View, type TextStyle } from 'react-native';
import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';

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
	onPress: () => void;
};

type CodeFieldProps = {
	value: string;
	style: TextStyle;
};

type PressableState = {
	pressed: boolean;
};

function SheetButton({ label, onPress }: SheetButtonProps) {
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }: PressableState) => ({
				alignItems: 'center',
				backgroundColor: pressed ? '#4752c4' : '#5865f2',
				borderRadius: 9,
				flex: 1,
				justifyContent: 'center',
				minHeight: 34,
				paddingHorizontal: 6,
			})}
		>
			<Text numberOfLines={1} style={{ color: '#f2f3f5', fontSize: 12, fontWeight: '700' }}>
				{label}
			</Text>
		</Pressable>
	);
}

function CodeField({ value, style }: CodeFieldProps) {
	return (
		<TextInput
			multiline
			scrollEnabled
			selectTextOnFocus
			showSoftInputOnFocus={false}
			style={[
				{
					backgroundColor: '#1e1f22',
					borderRadius: 8,
					color: '#dbdee1',
					fontFamily: 'Menlo',
					padding: 12,
					textAlignVertical: 'top',
				},
				style,
			]}
			value={value}
		/>
	);
}

function RawSheet({ type, json, content, onCopy, onClose }: RawSheetProps) {
	return (
		<Discord.ActionSheet startExpanded>
			<View
				style={{
					maxHeight: '85%',
					paddingHorizontal: 16,
					paddingTop: 10,
					paddingBottom: 18,
				}}
			>
				<Discord.Text variant='text-lg/semibold'>
					{format('RAW_TITLE', { type: typeName(type) })}
				</Discord.Text>
				{content ? (
					<>
						<Discord.Text style={{ marginTop: 16 }} variant='text-sm/semibold'>
							{messages.MESSAGE_CONTENT}
						</Discord.Text>
						<CodeField
							value={content}
							style={{ fontSize: 13, height: 96, marginTop: 6 }}
						/>
						<Discord.Text style={{ marginTop: 16 }} variant='text-sm/semibold'>
							{messages.MESSAGE_DATA}
						</Discord.Text>
					</>
				) : null}
				<CodeField
					value={json}
					style={{ fontSize: 12, marginTop: content ? 6 : 16, maxHeight: 480 }}
				/>
				<View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>
					<SheetButton
						label={messages.COPY_DATA}
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
