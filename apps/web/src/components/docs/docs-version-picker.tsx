import {
	MAIN_DOCS_VERSION,
	docsPackageSchema,
	type DocsVersion,
} from '@unbound-app/contracts/docs';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select';
import type { DocsNav } from '~/lib/docs/docs-page';
import { docsNavQuery } from '~/queries/docs/docs';

type DocsVersionPickerProps = {
	nav: DocsNav;
	/** The open symbol page, kept across a version switch when the other version has it. */
	symbol: string | undefined;
};

const PACKAGE_LABELS: Record<string, string> = Object.fromEntries(
	docsPackageSchema.enum.map((pkg) => [pkg, `@unbound-app/${pkg}`]),
);

function versionLabel(version: DocsVersion): string {
	return version === MAIN_DOCS_VERSION ? 'main (development)' : version;
}

/**
 * @description The SDK reference's package and version selects; switching version keeps the open symbol if it exists there.
 * @param props The version's navigation and the open symbol.
 * @returns The selects.
 */
function DocsVersionPicker({ nav, symbol }: DocsVersionPickerProps) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const versionLabels = Object.fromEntries(nav.versions.map((v) => [v, versionLabel(v)]));

	async function switchVersion(next: string | null) {
		const version = nav.versions.find((entry) => entry === next);

		if (!version || version === nav.version) return;

		const target = await queryClient.fetchQuery(docsNavQuery(nav.package, version));
		const kept = target?.groups.some((group) =>
			group.symbols.some((entry) => entry.qualifiedName === symbol),
		);

		if (symbol && kept) {
			await navigate({
				to: '/docs/sdk/$version/$symbol',
				params: { version, symbol },
			});

			return;
		}

		await navigate({
			to: '/docs/sdk/$version',
			params: { version },
		});
	}

	return (
		<div className='flex flex-col gap-2'>
			<Select items={PACKAGE_LABELS} value={nav.package}>
				<SelectTrigger size='sm' className='w-full' aria-label='Package'>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{docsPackageSchema.enum.map((pkg) => (
						<SelectItem key={pkg} value={pkg}>
							{PACKAGE_LABELS[pkg]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				items={versionLabels}
				value={nav.version}
				onValueChange={(next) => void switchVersion(next)}
			>
				<SelectTrigger size='sm' className='w-full' aria-label='Version'>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{nav.versions.map((version) => (
						<SelectItem key={version} value={version}>
							{versionLabel(version)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

export default DocsVersionPicker;
