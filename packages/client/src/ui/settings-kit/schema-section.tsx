import { useState, type ReactElement } from 'react';

import type { SettingPredicates } from '~/ui/settings-kit/conditions';
import type { LayoutSection } from '~/ui/settings-kit/schema-layout';
import useConditions from '~/ui/settings-kit/use-conditions';
import SchemaField from '~/ui/settings-kit/schema-field';
import type { DefinedSettings } from '~/storage/define';
import Section from '~/ui/settings-kit/section';
import { Discord } from '~/metro/components';

type SchemaSectionProps = {
	settings: DefinedSettings;
	section: LayoutSection;
	translate: (key: string) => string;
	predicates: SettingPredicates;
	runAction: (name: string) => void;
	onRestartNeeded: () => void;
};

/**
 * @description One section of a generated settings panel: its title, then its rows, inline ones grouped.
 * A collapsible section starts closed and opens from its title row.
 * @param props The plugin's settings, the section's layout, the message lookup, predicates and actions.
 * @returns The section's groups, or `null` while it is hidden or has no rows.
 */
function SchemaSection({
	settings,
	section,
	translate,
	predicates,
	runAction,
	onRestartNeeded,
}: SchemaSectionProps): ReactElement | null {
	const [open, setOpen] = useState(!section.collapsible);
	const { visible } = useConditions(settings, section.path, section.labels, predicates);
	const title = section.labels.title === undefined ? undefined : translate(section.labels.title);
	const description =
		section.labels.subtitle === undefined ? undefined : translate(section.labels.subtitle);

	if (!visible || section.blocks.length === 0) return null;

	const field = (item: LayoutSection['blocks'][number]['items'][number]) => (
		<SchemaField
			key={item.path}
			settings={settings}
			item={item}
			translate={translate}
			predicates={predicates}
			runAction={runAction}
			onRestartNeeded={onRestartNeeded}
		/>
	);

	return (
		<>
			{section.collapsible ? (
				<Discord.TableRowGroup>
					<Discord.TableRow
						label={title ?? section.path}
						subLabel={description}
						trailing={
							<Discord.Text variant='text-md/semibold' color='text-muted'>
								{open ? '−' : '+'}
							</Discord.Text>
						}
						onPress={() => setOpen(!open)}
					/>
				</Discord.TableRowGroup>
			) : null}
			{/* A section that opens with a radio group, list or input heads it with a title of its own. */}
			{!section.collapsible && title !== undefined && !section.blocks[0]?.inline ? (
				<Section title={title} description={description} />
			) : null}
			{open
				? section.blocks.map((block, index) =>
						block.inline ? (
							<Section
								key={`${section.path}-${index}`}
								title={index === 0 && !section.collapsible ? title : undefined}
								description={
									index === 0 && !section.collapsible ? description : undefined
								}
							>
								{block.items.map(field)}
							</Section>
						) : (
							block.items.map(field)
						),
					)
				: null}
		</>
	);
}

export default SchemaSection;
