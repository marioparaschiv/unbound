import type { AddonType } from '@unbound-app/contracts/addons';

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select';
import type { AddonSettingsForm } from '~/components/admin/addon-settings/use-addon-settings-form';
import { Field, FieldDescription, FieldError, FieldLabel } from '~/components/ui/field';
import PinnableField from '~/components/admin/addon-settings/pinnable-field';
import SettingsPanel from '~/components/admin/addon-settings/settings-panel';
import type { AdminAddonRecord, ManifestSummary } from '~/lib/admin-addon';
import AddonIconControl from '~/components/admin/addon-icon-control';
import Textarea from '~/components/ui/textarea';
import Input from '~/components/ui/input';

type ListingPanelProps = {
	form: AddonSettingsForm;
	/** What unpinned fields follow; `null` when nothing is served. */
	manifest: ManifestSummary | null;
	/** The saved addon, for its type and its saved icon's markup. */
	addon: AdminAddonRecord;
};

const TYPE_LABELS: Record<AddonType, string> = {
	plugin: 'Plugin',
	theme: 'Theme',
	'icon-pack': 'Icon pack',
	font: 'Font',
};

function ListingPanel({ form, manifest, addon }: ListingPanelProps) {
	return (
		<SettingsPanel
			title='Listing'
			description='What the store shows. Each field follows the served version’s manifest until you override it.'
			hint='Overrides stay through approvals. Fields on the manifest update with each served version.'
		>
			<div className='gap-6 grid md:grid-cols-[2fr_1fr]'>
				<form.Field name='icon'>
					{(field) => (
						<Field className='gap-2 md:col-span-2'>
							<FieldLabel htmlFor='edit-icon'>Icon</FieldLabel>
							<AddonIconControl
								id='edit-icon'
								type={addon.type}
								value={field.state.value}
								saved={addon.icon}
								savedSvg={addon.iconSvg}
								onChange={(icon) => field.handleChange(icon)}
							/>
							<FieldDescription>
								Only the website shows it; the app keeps the manifest’s icon.
							</FieldDescription>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>

				<form.Field name='name'>
					{(field) => (
						<PinnableField
							id='edit-name'
							label='Name'
							pinned={field.state.value !== null}
							manifestValue={manifest?.name ?? ''}
							onOverride={() => field.handleChange(manifest?.name ?? '')}
							onFollow={() => field.handleChange(null)}
							errors={field.state.meta.errors}
						>
							<Input
								id='edit-name'
								value={field.state.value ?? ''}
								onChange={(event) => field.handleChange(event.target.value)}
								onBlur={field.handleBlur}
								aria-invalid={field.state.meta.errors.length > 0}
							/>
						</PinnableField>
					)}
				</form.Field>

				<form.Field name='type'>
					{(field) => (
						<PinnableField
							id='edit-type'
							label='Type'
							pinned={field.state.value !== null}
							manifestValue={manifest ? TYPE_LABELS[manifest.type] : ''}
							onOverride={() => field.handleChange(manifest?.type ?? 'plugin')}
							onFollow={() => field.handleChange(null)}
							errors={field.state.meta.errors}
						>
							<Select
								items={TYPE_LABELS}
								value={field.state.value}
								onValueChange={(type) => field.handleChange(type)}
							>
								<SelectTrigger
									id='edit-type'
									className='w-full'
									onBlur={field.handleBlur}
									aria-invalid={field.state.meta.errors.length > 0}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(TYPE_LABELS).map(([type, label]) => (
										<SelectItem key={type} value={type}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</PinnableField>
					)}
				</form.Field>

				<form.Field name='description'>
					{(field) => (
						<div className='md:col-span-2'>
							<PinnableField
								id='edit-description'
								label='Description'
								multiline
								pinned={field.state.value !== null}
								manifestValue={manifest?.description ?? ''}
								onOverride={() => field.handleChange(manifest?.description ?? '')}
								onFollow={() => field.handleChange(null)}
								errors={field.state.meta.errors}
							>
								<Textarea
									id='edit-description'
									value={field.state.value ?? ''}
									onChange={(event) => field.handleChange(event.target.value)}
									onBlur={field.handleBlur}
									aria-invalid={field.state.meta.errors.length > 0}
								/>
							</PinnableField>
						</div>
					)}
				</form.Field>
			</div>
		</SettingsPanel>
	);
}

export default ListingPanel;
