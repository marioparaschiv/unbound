import { useState, type ReactElement } from 'react';

import type { SettingPredicates } from '~/ui/settings-kit/conditions';
import type { LayoutSection } from '~/ui/settings-kit/schema-layout';
import CollapsibleGroup from '~/ui/components/collapsible-group';
import useConditions from '~/ui/settings-kit/use-conditions';
import SchemaField from '~/ui/settings-kit/schema-field';
import type { DefinedSettings } from '~/storage/define';
import Section from '~/ui/settings-kit/section';

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
 * A collapsible section starts closed: its title row heads a `CollapsibleGroup` that animates its leading inline rows
 * open, and its other blocks follow below while it is open.
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
	const [open, setOpen] = useState(false);
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

	if (section.collapsible) {
		const [first, ...rest] = section.blocks;
		const lead = first?.inline ? first : undefined;

		return (
			<>
				<CollapsibleGroup
					label={title ?? section.path}
					subLabel={description}
					defaultExpanded={false}
					onToggle={setOpen}
				>
					{lead?.items.map(field)}
				</CollapsibleGroup>
				{open
					? (lead ? rest : section.blocks).map((block, index) =>
							block.inline ? (
								<Section key={`${section.path}-${index}`}>
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

	return (
		<>
			{/* A section that opens with a radio group, list or input heads it with a title of its own. */}
			{title !== undefined && !section.blocks[0]?.inline ? (
				<Section title={title} description={description} />
			) : null}
			{section.blocks.map((block, index) =>
				block.inline ? (
					<Section
						key={`${section.path}-${index}`}
						title={index === 0 ? title : undefined}
						description={index === 0 ? description : undefined}
					>
						{block.items.map(field)}
					</Section>
				) : (
					block.items.map(field)
				),
			)}
		</>
	);
}

export default SchemaSection;
