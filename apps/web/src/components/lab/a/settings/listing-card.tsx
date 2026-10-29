import type { AddonType } from '@unbound-app/contracts/addons';
import type { ReactNode } from 'react';

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select';
import { Card, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import type { ManifestSummary } from '~/lib/admin-addon';
import Textarea from '~/components/ui/textarea';
import Switch from '~/components/ui/switch';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';

import type { SettingsForm } from './use-settings-form';
import type { EditableKey } from './changes';

import SettingRow from './setting-row';

type ListingCardProps = {
	form: SettingsForm;
	/** What fields that follow the manifest show; `null` when nothing is served. */
	manifest: ManifestSummary | null;
	changed: EditableKey[];
};

type FollowSwitchProps = {
	id: string;
	following: boolean;
	onFollow: () => void;
	onOverride: () => void;
};

type ManifestValueProps = {
	value: string;
	multiline?: boolean;
};

type OverrideHintProps = {
	value: string;
	manifestValue: string;
};

const TYPE_LABELS: Record<AddonType, string> = {
	plugin: 'Plugin',
	theme: 'Theme',
	'icon-pack': 'Icon pack',
	font: 'Font',
};

function FollowSwitch({ id, following, onFollow, onOverride }: FollowSwitchProps) {
	return (
		<label
			htmlFor={`${id}-follow`}
			className='flex items-center gap-2.5 w-fit font-medium text-sm cursor-pointer'
		>
			<Switch
				id={`${id}-follow`}
				checked={following}
				onCheckedChange={(checked) => (checked ? onFollow() : onOverride())}
			/>
			Use manifest value
		</label>
	);
}

function ManifestValue({ value, multiline = false }: ManifestValueProps) {
	return (
		<Text
			variant='text-sm'
			color='muted'
			className={multiline ? 'whitespace-pre-wrap break-words' : 'truncate'}
		>
			{value || 'Nothing is served yet, so there is no manifest value.'}
		</Text>
	);
}

function OverrideHint({ value, manifestValue }: OverrideHintProps) {
	let hint: ReactNode = 'Overridden. New versions will not change it.';

	if (value !== manifestValue && manifestValue) {
		hint = (
			<>
				The manifest says <span className='text-foreground'>{manifestValue}</span>.
			</>
		);
	}

	return (
		<Text variant='text-xs' color='muted' className='line-clamp-2'>
			{hint}
		</Text>
	);
}

function ListingCard({ form, manifest, changed }: ListingCardProps) {
	return (
		<Card className='gap-0 pb-0'>
			<CardHeader className='pb-2'>
				<CardTitle>Listing</CardTitle>
				<CardDescription>
					What the store shows. Each field follows the served version’s manifest unless
					you turn “Use manifest value” off and write your own.
				</CardDescription>
			</CardHeader>
			<div className='divide-y divide-border'>
				<form.Field name='name'>
					{(field) => {
						const manifestValue = manifest?.name ?? '';
						const following = field.state.value === null;

						return (
							<SettingRow
								id='lab-a-name'
								label='Name'
								description='The title on the store and in the app.'
								changed={changed.includes('name')}
								errors={field.state.meta.errors}
								aside={
									<FollowSwitch
										id='lab-a-name'
										following={following}
										onFollow={() => field.handleChange(null)}
										onOverride={() => field.handleChange(manifestValue)}
									/>
								}
							>
								{following ? (
									<ManifestValue value={manifestValue} />
								) : (
									<>
										<Input
											id='lab-a-name'
											value={field.state.value ?? ''}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											onBlur={field.handleBlur}
											aria-invalid={field.state.meta.errors.length > 0}
										/>
										<OverrideHint
											value={field.state.value ?? ''}
											manifestValue={manifestValue}
										/>
									</>
								)}
							</SettingRow>
						);
					}}
				</form.Field>

				<form.Field name='type'>
					{(field) => {
						const following = field.state.value === null;

						return (
							<SettingRow
								id='lab-a-type'
								label='Type'
								description='Which store section lists it.'
								changed={changed.includes('type')}
								errors={field.state.meta.errors}
								aside={
									<FollowSwitch
										id='lab-a-type'
										following={following}
										onFollow={() => field.handleChange(null)}
										onOverride={() =>
											field.handleChange(manifest?.type ?? 'plugin')
										}
									/>
								}
							>
								{following ? (
									<ManifestValue
										value={manifest ? TYPE_LABELS[manifest.type] : ''}
									/>
								) : (
									<>
										<Select
											items={TYPE_LABELS}
											value={field.state.value}
											onValueChange={(type) => field.handleChange(type)}
										>
											<SelectTrigger
												id='lab-a-type'
												className='w-full md:w-60'
												onBlur={field.handleBlur}
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{Object.entries(TYPE_LABELS).map(
													([type, label]) => (
														<SelectItem key={type} value={type}>
															{label}
														</SelectItem>
													),
												)}
											</SelectContent>
										</Select>
										<OverrideHint
											value={
												field.state.value
													? TYPE_LABELS[field.state.value]
													: ''
											}
											manifestValue={
												manifest ? TYPE_LABELS[manifest.type] : ''
											}
										/>
									</>
								)}
							</SettingRow>
						);
					}}
				</form.Field>

				<form.Field name='description'>
					{(field) => {
						const manifestValue = manifest?.description ?? '';
						const following = field.state.value === null;

						return (
							<SettingRow
								id='lab-a-description'
								label='Description'
								description='The short summary under the name.'
								changed={changed.includes('description')}
								errors={field.state.meta.errors}
								aside={
									<FollowSwitch
										id='lab-a-description'
										following={following}
										onFollow={() => field.handleChange(null)}
										onOverride={() => field.handleChange(manifestValue)}
									/>
								}
							>
								{following ? (
									<ManifestValue value={manifestValue} multiline />
								) : (
									<>
										<Textarea
											id='lab-a-description'
											value={field.state.value ?? ''}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											onBlur={field.handleBlur}
											aria-invalid={field.state.meta.errors.length > 0}
										/>
										<OverrideHint
											value={field.state.value ?? ''}
											manifestValue={manifestValue}
										/>
									</>
								)}
							</SettingRow>
						);
					}}
				</form.Field>

				<form.Field name='repository'>
					{(field) => (
						<SettingRow
							id='lab-a-repository'
							label='Source repository'
							description='The GitHub repository the addon is built from.'
							changed={changed.includes('repository')}
							errors={field.state.meta.errors}
						>
							<Input
								id='lab-a-repository'
								placeholder='owner/name'
								className='md:w-80'
								value={field.state.value ?? ''}
								onChange={(event) =>
									field.handleChange(event.target.value.trim() || null)
								}
								onBlur={field.handleBlur}
								aria-invalid={field.state.meta.errors.length > 0}
							/>
						</SettingRow>
					)}
				</form.Field>

				<form.Field name='delisted'>
					{(field) => (
						<SettingRow
							id='lab-a-listed'
							label='Visibility'
							description='Delisted addons are hidden from listings, the catalog and update checks. Existing installs keep working.'
							changed={changed.includes('delisted')}
						>
							<label
								htmlFor='lab-a-listed'
								className='flex items-center gap-2.5 w-fit font-medium text-sm cursor-pointer'
							>
								<Switch
									id='lab-a-listed'
									checked={!field.state.value}
									onCheckedChange={(checked) => field.handleChange(!checked)}
								/>
								{field.state.value
									? 'Delisted, hidden from the store'
									: 'Listed in the store'}
							</label>
						</SettingRow>
					)}
				</form.Field>
			</div>
		</Card>
	);
}

export default ListingCard;
