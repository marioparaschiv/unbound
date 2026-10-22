import {
	mediaUri,
	type PickedMedia,
	persistMedia,
	pickMedia,
	removeStoredMedia,
} from '@custom-commands/media';
import {
	normalizeTags,
	parseTagArguments,
	type Tag,
	type TagMedia,
	validateTag,
} from '@custom-commands/tags';

import {
	getSettingsColors,
	SettingsButton,
	SettingsCard,
	SettingsScrollView,
	SettingsSection,
	type SettingsTouchEvent,
} from '@shared/settings-ui';
import { metro, storage, toasts } from '@unbound-app/api';
import { useState } from 'react';

const STORE = storage.getStore('unbound.custom-commands');

type DraftMedia = PickedMedia | TagMedia;

function isStoredMedia(media: DraftMedia): media is TagMedia {
	return 'storedName' in media;
}

function showError(error: unknown): void {
	toasts.showToast({
		title: 'Custom Commands',
		content: error instanceof Error ? error.message : 'The command could not be saved.',
	});
}

function FormField({
	label,
	value,
	placeholder,
	onChange,
	multiline = false,
	maxLength,
}: {
	label: string;
	value: string;
	placeholder: string;
	onChange: (value: string) => void;
	multiline?: boolean;
	maxLength?: number;
}) {
	const ReactNative = metro.common.ReactNative;
	const colors = getSettingsColors();

	return (
		<ReactNative.View style={{ gap: 8 }}>
			<ReactNative.Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
				{label}
			</ReactNative.Text>
			<ReactNative.TextInput
				autoCapitalize='none'
				autoCorrect={false}
				maxLength={maxLength}
				multiline={multiline}
				onChangeText={onChange}
				placeholder={placeholder}
				placeholderTextColor={colors.muted}
				style={{
					backgroundColor: colors.input,
					borderColor: colors.border,
					borderRadius: 12,
					borderWidth: 1,
					color: colors.text,
					fontSize: 16,
					minHeight: multiline ? 120 : 48,
					paddingHorizontal: 14,
					paddingVertical: 12,
					textAlignVertical: multiline ? 'top' : 'center',
				}}
				value={value}
			/>
		</ReactNative.View>
	);
}

function MediaRow({ media, onRemove }: { media: DraftMedia; onRemove: () => void }) {
	const ReactNative = metro.common.ReactNative;
	const colors = getSettingsColors();
	const mimeType = isStoredMedia(media) ? media.mimeType : media.type;
	const uri = isStoredMedia(media) ? mediaUri(media) : media.uri;
	const fileName = media.fileName;

	return (
		<SettingsCard>
			<ReactNative.View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
				{mimeType.startsWith('image/') ? (
					<ReactNative.Image
						source={{ uri }}
						style={{ borderRadius: 8, height: 48, width: 48 }}
					/>
				) : (
					<ReactNative.View
						style={{
							alignItems: 'center',
							backgroundColor: colors.input,
							borderRadius: 8,
							height: 48,
							justifyContent: 'center',
							width: 48,
						}}
					>
						<ReactNative.Text style={{ color: colors.text, fontSize: 24 }}>
							▶
						</ReactNative.Text>
					</ReactNative.View>
				)}
				<ReactNative.View style={{ flex: 1, gap: 3 }}>
					<ReactNative.Text
						numberOfLines={1}
						style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}
					>
						{fileName}
					</ReactNative.Text>
					<ReactNative.Text style={{ color: colors.muted, fontSize: 12 }}>
						{mimeType.startsWith('video/') ? 'Video' : 'Image'} ·{' '}
						{Math.round(media.fileSize / 1024)} KB
					</ReactNative.Text>
				</ReactNative.View>
				<ReactNative.Pressable
					accessibilityLabel={`Remove ${fileName}`}
					accessibilityRole='button'
					hitSlop={8}
					onPress={onRemove}
					style={{
						alignItems: 'center',
						height: 40,
						justifyContent: 'center',
						width: 40,
					}}
				>
					<ReactNative.Text style={{ color: colors.danger, fontSize: 27 }}>
						×
					</ReactNative.Text>
				</ReactNative.Pressable>
			</ReactNative.View>
		</SettingsCard>
	);
}

export function CustomCommandsSettings() {
	const ReactNative = metro.common.ReactNative;
	const colors = getSettingsColors();
	const settings = STORE.useSettingsStore();
	const tags = normalizeTags(settings.get('tags', []));
	const [editing, setEditing] = useState<Tag | null>(null);
	const [creating, setCreating] = useState(false);
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [message, setMessage] = useState('');
	const [media, setMedia] = useState<DraftMedia[]>([]);
	const [busy, setBusy] = useState(false);
	const [picking, setPicking] = useState(false);

	function dismissKeyboardOutsideInput(event: SettingsTouchEvent): void {
		const focusedInput = ReactNative.TextInput.State.currentlyFocusedInput();
		if (!focusedInput) return;
		const focusedField = ReactNative.TextInput.State.currentlyFocusedField();
		if (event.target === focusedInput || Number(event.target) === focusedField) return;
		ReactNative.Keyboard.dismiss();
	}

	function closeForm(): void {
		setCreating(false);
		setEditing(null);
		setName('');
		setDescription('');
		setMessage('');
		setMedia([]);
	}

	function openForm(tag: Tag | null): void {
		setEditing(tag);
		setCreating(true);
		setName(tag?.name ?? '');
		setDescription(tag?.description ?? '');
		setMessage(tag?.message ?? '');
		setMedia(tag?.media ?? []);
	}

	async function addMedia(): Promise<void> {
		if (picking) return;
		setPicking(true);
		try {
			const picked = await pickMedia();
			if (media.length + picked.length > 10)
				throw new Error('A command can have at most 10 attachments.');
			setMedia((current) => [...current, ...picked]);
		} catch (error) {
			showError(error);
		} finally {
			setPicking(false);
		}
	}

	async function saveTag(): Promise<void> {
		if (busy) return;
		const normalizedName = name.trim().toLowerCase();
		const normalizedDescription = description.trim();
		const draft: Tag = {
			name: normalizedName,
			description: normalizedDescription,
			message,
			media: media.filter(isStoredMedia),
		};
		const validation = validateTag(draft, tags, editing?.name, media.length);
		if (validation) {
			showError(new Error(validation));
			return;
		}

		const builtIns =
			(
				metro.findByProps('getBuiltInCommands') as {
					BUILT_IN_COMMANDS?: Array<{ displayName?: string }>;
				} | null
			)?.BUILT_IN_COMMANDS ?? [];
		if (builtIns.some((command) => command.displayName === normalizedName)) {
			showError(new Error('This command name is already used by Discord.'));
			return;
		}

		setBusy(true);
		const newlyStored: TagMedia[] = [];
		try {
			for (const item of media) {
				if (isStoredMedia(item)) continue;
				newlyStored.push(await persistMedia(item));
			}
			const nextTag: Tag = {
				name: normalizedName,
				...(normalizedDescription ? { description: normalizedDescription } : {}),
				message,
				media: [...media.filter(isStoredMedia), ...newlyStored],
			};
			const nextTags = tags.filter((tag) => tag.name !== editing?.name);
			nextTags.push(nextTag);
			STORE.set('tags', nextTags);
			const retainedNames = new Set(nextTag.media.map((item) => item.storedName));
			for (const oldMedia of editing?.media ?? []) {
				if (!retainedNames.has(oldMedia.storedName)) await removeStoredMedia(oldMedia);
			}
			closeForm();
			toasts.showToast({ title: 'Custom Commands', content: `Saved /${normalizedName}.` });
		} catch (error) {
			await Promise.all(newlyStored.map((item) => removeStoredMedia(item).catch(() => {})));
			showError(error);
		} finally {
			setBusy(false);
		}
	}

	function deleteTag(tag: Tag): void {
		ReactNative.Alert.alert(
			'Delete command',
			`Delete /${tag.name} and its saved attachments?`,
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete',
					style: 'destructive',
					onPress: () => {
						STORE.set(
							'tags',
							tags.filter((entry) => entry.name !== tag.name),
						);
						void Promise.all(
							tag.media.map((item) => removeStoredMedia(item).catch(() => {})),
						);
					},
				},
			],
		);
	}

	const detectedArguments = parseTagArguments(message);

	return (
		<SettingsScrollView onTouchStart={dismissKeyboardOutsideInput}>
			<ReactNative.Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
				Create slash commands that send saved text, images, and videos.
			</ReactNative.Text>
			{creating ? (
				<SettingsSection title={editing ? 'Edit command' : 'Create command'}>
					<FormField
						label='Command name'
						onChange={setName}
						placeholder='greet'
						value={name}
					/>
					<FormField
						label='Description (optional)'
						maxLength={100}
						onChange={setDescription}
						placeholder='Shown in the slash-command list'
						value={description}
					/>
					<FormField
						label='Response'
						multiline
						onChange={setMessage}
						placeholder='Hello {{user}}! I am feeling {{mood = great}}.'
						value={message}
					/>
					<ReactNative.Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
						Use {'{{argument}}'} for required text or {'{{argument = default}}'} for
						optional text. Type {'\\n'} for a line break. Every command also has an
						optional ephemeral switch.
					</ReactNative.Text>
					{detectedArguments.length ? (
						<ReactNative.Text
							style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}
						>
							Arguments:{' '}
							{detectedArguments.map((argument) => argument.name).join(', ')}
						</ReactNative.Text>
					) : null}
					{media.map((item, index) => (
						<MediaRow
							key={isStoredMedia(item) ? item.storedName : `${item.uri}-${index}`}
							media={item}
							onRemove={() =>
								setMedia((current) =>
									current.filter((_, position) => position !== index),
								)
							}
						/>
					))}
					<SettingsButton
						label={picking ? 'Opening Photos…' : 'Attach media'}
						onPress={() => void addMedia()}
					/>
					<SettingsButton
						label={busy ? 'Saving…' : editing ? 'Save command' : 'Create command'}
						onPress={() => void saveTag()}
					/>
					<ReactNative.Pressable
						onPress={closeForm}
						style={{ alignItems: 'center', justifyContent: 'center', minHeight: 48 }}
					>
						<ReactNative.Text
							style={{ color: colors.muted, fontSize: 16, fontWeight: '700' }}
						>
							Cancel
						</ReactNative.Text>
					</ReactNative.Pressable>
				</SettingsSection>
			) : (
				<SettingsSection title='Registered commands'>
					{tags.length ? (
						tags.map((tag) => (
							<SettingsCard key={tag.name}>
								<ReactNative.View
									style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}
								>
									<ReactNative.View style={{ flex: 1, gap: 4 }}>
										<ReactNative.Text
											style={{
												color: colors.text,
												fontSize: 16,
												fontWeight: '700',
											}}
										>
											/{tag.name}
										</ReactNative.Text>
										<ReactNative.Text
											numberOfLines={2}
											style={{ color: colors.muted, fontSize: 13 }}
										>
											{tag.description ||
												tag.message ||
												`${tag.media.length} attachment${tag.media.length === 1 ? '' : 's'}`}
										</ReactNative.Text>
									</ReactNative.View>
									<ReactNative.Pressable
										accessibilityLabel={`Edit ${tag.name}`}
										onPress={() => openForm(tag)}
									>
										<ReactNative.Text
											style={{
												color: colors.accent,
												fontSize: 14,
												fontWeight: '700',
											}}
										>
											Edit
										</ReactNative.Text>
									</ReactNative.Pressable>
									<ReactNative.Pressable
										accessibilityLabel={`Delete ${tag.name}`}
										onPress={() => deleteTag(tag)}
									>
										<ReactNative.Text
											style={{
												color: colors.danger,
												fontSize: 14,
												fontWeight: '700',
											}}
										>
											Delete
										</ReactNative.Text>
									</ReactNative.Pressable>
								</ReactNative.View>
							</SettingsCard>
						))
					) : (
						<SettingsCard>
							<ReactNative.Text style={{ color: colors.muted, fontSize: 15 }}>
								No custom commands yet.
							</ReactNative.Text>
						</SettingsCard>
					)}
					<SettingsButton label='Create command' onPress={() => openForm(null)} />
				</SettingsSection>
			)}
		</SettingsScrollView>
	);
}
