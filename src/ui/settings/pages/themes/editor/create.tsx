import { Keys } from '@constants';
import { React, ReactNative, Theme, i18n } from '@metro/common';
import { Button, Navigation } from '@metro/components';
import Editor from './editor';
import { useSettingsStore } from '@api/storage';
import { StaticSection, styles } from './index';
import { Theme as ThemeStore } from '@metro/stores';

export const inputs = [
	{
		key: 'name',
		title: 'Name',
		placeholder: 'e.g. Rosie Blue'
	},
	{
		key: 'description',
		title: 'Description',
		placeholder: 'e.g. A beautiful dark theme with a touch of blue highlights',
		properties: {
			multiline: true,
			numberOfLines: 2
		}
	},
	{
		key: 'id',
		title: 'ID',
		placeholder: 'e.g. rosie.blue'
	}
];

export default () => {
	const navigation = Navigation.useNavigation();
	const [error, setError] = React.useState('');
	const settings = useSettingsStore('create-theme');

	const manifest = {
		get name() {
			return settings.get('name', '');
		},

		get description() {
			return settings.get('description', '');
		},

		get id() {
			return settings.get('id', '');
		},

		authors: [{ id: null, name: null }],
	};

	return <ReactNative.KeyboardAvoidingView
		enabled={true}
		behavior='position'
		style={{ marginBottom: 50 }}
		keyboardVerticalOffset={100}
		contentContainerStyle={{ backfaceVisibility: 'hidden' }}
	>
		<StaticSection>
			<ReactNative.Text style={styles.header}>{i18n.Messages.UNBOUND_THEME_EDITOR_GET_STARTED}</ReactNative.Text>
		</StaticSection>
		<StaticSection style={{ padding: 24, textAlign: 'auto' }}>
			{inputs.map(({ key, title, placeholder, properties }) => <>
				<ReactNative.Text style={[styles.eyebrow, { textAlign: 'left', marginBottom: 16 }]}>{title}</ReactNative.Text>

				<ReactNative.TextInput
					placeholder={placeholder}
					placeholderTextColor={Theme.meta.resolveSemanticColor(ThemeStore.theme, Theme.colors.TEXT_MUTED)}
					value={settings.get(key, '')}
					onChangeText={(value: string) => settings.set(key, value)}
					style={styles.input}
					{...properties ? properties : {}}
				/>
			</>)}

			<ReactNative.Text style={[styles.eyebrow, { textAlign: 'center', marginVertical: 16 }]}>{error}</ReactNative.Text>
			<Button
				text={i18n.Messages.UNBOUND_THEME_EDITOR_CREATE_CONTINUE}
				style={styles.button}
				onPress={() => {
					for (const input of inputs) {
						if (!settings.get(input.key, '')) {
							return setError(i18n.Messages.UNBOUND_THEME_EDITOR_CREATE_ITEM_EMPTY.format({ item: input.title }));
						}
					}

					navigation.push(Keys.Custom, {
						title: i18n.Messages.UNBOUND_THEME_EDITOR_EDIT_THEME_TITLE,
						render: () => <Editor
							manifest={manifest}
							bundle={{ semantic: {}, raw: {} }}
						/>
					});
				}}
			/>
		</StaticSection>
	</ReactNative.KeyboardAvoidingView>;
};