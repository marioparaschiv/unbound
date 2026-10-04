function resolveMomentLocale(locale: string, availableLocales: string[]): string {
	const normalizedLocale = locale.replaceAll('_', '-').toLowerCase();
	if (availableLocales.includes(normalizedLocale)) return normalizedLocale;

	const language = normalizedLocale.split('-')[0];
	if (availableLocales.includes(language)) return language;

	return (
		availableLocales.find((availableLocale) => availableLocale.split('-')[0] === language) ??
		'en'
	);
}

export default resolveMomentLocale;
