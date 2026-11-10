import { Pressable, View } from 'react-native';

import type { DialogContentProps } from '~/dialogs/api';
import { Discord } from '~/metro/components';
import { format } from '~/i18n/api';

import type { FontVariantChoice } from './use-font-install';

import useStyles from './font-install-dialog.style';
import useFontInstall from './use-font-install';

function variantLabel(variant: FontVariantChoice): string {
	return format(
		variant.style === 'italic' ? 'UNBOUND_FONTS_VARIANT_ITALIC' : 'UNBOUND_FONTS_VARIANT',
		{ weight: variant.weight },
	);
}

/**
 * @description The Install a font dialog's body: a focused field for a name or link, Find to resolve it, then a chip
 * per weight and style to choose what Install hands the loader. Installing closes the dialog.
 */
function FontInstallDialog({ dismiss }: DialogContentProps) {
	const styles = useStyles();
	const install = useFontInstall(dismiss);
	const count = install.wholeFiles ? install.variants.length : install.selected.size;

	return (
		<View style={styles.content}>
			<Discord.TextInput
				value={install.input}
				placeholder='Inter'
				autoFocus
				autoCapitalize='none'
				autoCorrect={false}
				returnKeyType='search'
				status={install.error ? 'error' : undefined}
				errorMessage={install.error}
				onChange={install.edit}
				onSubmitEditing={install.find}
			/>
			{install.resolved ? (
				<View style={styles.found}>
					<Discord.Text variant='text-md/semibold' color='mobile-text-heading-primary'>
						{install.resolved.family}
					</Discord.Text>
					{install.wholeFiles ? (
						<Discord.Text variant='text-sm/medium' color='text-muted'>
							{format('UNBOUND_FONTS_EVERY_FONT')}
						</Discord.Text>
					) : (
						<View style={styles.chips}>
							{install.variants.map((variant) => {
								const selected = install.selected.has(variant.key);

								return (
									<Pressable
										key={variant.key}
										accessibilityRole='checkbox'
										accessibilityState={{ checked: selected }}
										onPress={() => install.toggle(variant.key)}
										style={[styles.chip, selected ? styles.selected : null]}
									>
										<Discord.Text
											variant='text-sm/semibold'
											style={selected ? styles.selectedLabel : styles.label}
										>
											{variantLabel(variant)}
										</Discord.Text>
									</Pressable>
								);
							})}
						</View>
					)}
				</View>
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
	);
}

export default FontInstallDialog;
