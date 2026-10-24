import { Discord } from '@unbound-app/api/metro/components';
import { useState } from 'react';

import { MAX_ATTACHMENTS, MAX_DESCRIPTION_LENGTH } from '~/constants';
import { parseTagArguments, validateTag } from '~/tags';
import { saveTag } from '~/saved-commands';
import MediaRow from '~/components/media-row';
import { notify, notifyError } from '~/notify';
import { isSaved, pickMedia } from '~/media';
import type { DraftMedia } from '~/media';
import type { Tag } from '~/tags';
import { Commands } from '~/modules';

type DiscordCommand = {
	displayName: string;
};

type CommandFormProps = {
	original: Tag | null;
	tags: Tag[];
	onClose: () => void;
};

function isBuiltInCommand(name: string): boolean {
	const commands: DiscordCommand[] = Commands.BUILT_IN_COMMANDS ?? [];

	return commands.some((command) => command.displayName === name);
}

function CommandForm({ original, tags, onClose }: CommandFormProps) {
	const [name, setName] = useState(original?.name ?? '');
	const [description, setDescription] = useState(original?.description ?? '');
	const [message, setMessage] = useState(original?.message ?? '');
	const [media, setMedia] = useState<DraftMedia[]>(original?.media ?? []);
	const [picking, setPicking] = useState(false);
	const [saving, setSaving] = useState(false);
	const detectedArguments = parseTagArguments(message);

	async function addMedia() {
		if (picking) return;

		setPicking(true);

		try {
			const picked = await pickMedia();

			if (media.length + picked.length > MAX_ATTACHMENTS) {
				throw new Error(`A command can have at most ${MAX_ATTACHMENTS} attachments.`);
			}

			setMedia((current) => [...current, ...picked]);
		} catch (error) {
			notifyError(error, 'The command could not be saved.');
		} finally {
			setPicking(false);
		}
	}

	async function save() {
		if (saving) return;

		const fields = {
			name: name.trim().toLowerCase(),
			description: description.trim(),
			message,
		};
		const problem =
			validateTag(
				{ ...fields, media: media.filter(isSaved) },
				tags,
				original?.name,
				media.length,
			) ??
			(isBuiltInCommand(fields.name)
				? 'This command name is already used by Discord.'
				: null);

		if (problem) {
			notify(problem);

			return;
		}

		setSaving(true);

		try {
			await saveTag(fields, media, original);
			onClose();
			notify(`Saved /${fields.name}.`);
		} catch (error) {
			notifyError(error, 'The command could not be saved.');
		} finally {
			setSaving(false);
		}
	}

	return (
		<Discord.Stack spacing={16}>
			<Discord.TableRowGroupTitle title={original ? 'Edit command' : 'Create command'} />
			<Discord.TextInput
				title='Command name'
				placeholder='greet'
				autoCapitalize='none'
				autoCorrect={false}
				value={name}
				onChange={setName}
			/>
			<Discord.TextInput
				title='Description (optional)'
				placeholder='Shown in the slash-command list'
				autoCapitalize='none'
				autoCorrect={false}
				maxLength={MAX_DESCRIPTION_LENGTH}
				value={description}
				onChange={setDescription}
			/>
			<Discord.TextInput
				title='Response'
				placeholder='Hello {{user}}! I am feeling {{mood = great}}.'
				helpText='Use {{argument}} for required text or {{argument = default}} for optional text. Type \n for a line break. Every command also has an optional ephemeral switch.'
				autoCapitalize='none'
				autoCorrect={false}
				multiline
				value={message}
				onChange={setMessage}
			/>
			{detectedArguments.length ? (
				<Discord.Text variant='text-sm/normal' color='text-muted'>
					Arguments: {detectedArguments.map((argument) => argument.name).join(', ')}
				</Discord.Text>
			) : null}
			{media.length ? (
				<Discord.TableRowGroup>
					{media.map((item, index) => (
						<MediaRow
							key={isSaved(item) ? item.storedName : `${item.uri}-${index}`}
							media={item}
							onRemove={() =>
								setMedia((current) =>
									current.filter((_, position) => position !== index),
								)
							}
						/>
					))}
				</Discord.TableRowGroup>
			) : null}
			<Discord.Button
				variant='secondary'
				text={picking ? 'Opening Photos…' : 'Attach media'}
				onPress={() => void addMedia()}
			/>
			<Discord.Button
				text={saving ? 'Saving…' : original ? 'Save command' : 'Create command'}
				onPress={() => void save()}
			/>
			<Discord.Button variant='tertiary' text='Cancel' onPress={onClose} />
		</Discord.Stack>
	);
}

export default CommandForm;
