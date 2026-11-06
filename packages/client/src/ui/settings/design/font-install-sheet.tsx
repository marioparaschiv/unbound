import { View } from 'react-native';

import { BottomSheets, Discord } from '~/metro/components';
import { format } from '~/i18n/api';

import useStyles from './font-install-sheet.style';
import useFontInstall from './use-font-install';

type FontInstallSheetProps = {
	onClose: () => void;
};

/**
 * @description Installs a font by name or link: Find resolves it, the variant checklist picks the
 * weights and styles, and Install hands both to the loader, which downloads and checks every file.
 */
function FontInstallSheet({ onClose }: FontInstallSheetProps) {
	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const install = useFontInstall(onClose);
	const styles = useStyles();
	const count = install.wholeFiles ? install.variants.length : install.selected.size;

	return (
		<ActionSheet>
			<BottomSheetTitleHeader
				title={format('UNBOUND_FONTS_INSTALL')}
				subtitle={format('UNBOUND_FONTS_INSTALL_HINT')}
			/>
			<View style={styles.content}>
				<Discord.TextInput
					value={install.input}
					placeholder='Inter'
					autoFocus
					autoCapitalize='none'
					autoCorrect={false}
					status={install.error ? 'error' : undefined}
					errorMessage={install.error}
					onChange={install.edit}
					onSubmitEditing={install.find}
				/>
				{install.resolved ? (
					<Discord.TableRowGroup title={install.resolved.family}>
						{install.wholeFiles ? (
							<Discord.TableRow label={format('UNBOUND_FONTS_EVERY_FONT')} />
						) : null}
						{install.variants.map((variant) => (
							<Discord.TableCheckboxRow
								key={variant.key}
								label={format(
									variant.style === 'italic'
										? 'UNBOUND_FONTS_VARIANT_ITALIC'
										: 'UNBOUND_FONTS_VARIANT',
									{ weight: variant.weight },
								)}
								checked={install.selected.has(variant.key)}
								onPress={() => install.toggle(variant.key)}
							/>
						))}
					</Discord.TableRowGroup>
				) : null}
				{install.resolved ? (
					<Discord.Button
						text={
							install.wholeFiles && install.variants.length === 0
								? format('UNBOUND_INSTALL')
								: format('UNBOUND_FONTS_INSTALL_COUNT', { count })
						}
						variant='primary'
						loading={install.busy}
						disabled={!install.wholeFiles && count === 0}
						onPress={install.install}
					/>
				) : (
					<Discord.Button
						text={format('UNBOUND_FONTS_FIND')}
						variant='primary'
						loading={install.busy}
						disabled={!install.input.trim()}
						onPress={install.find}
					/>
				)}
			</View>
		</ActionSheet>
	);
}

export default FontInstallSheet;
