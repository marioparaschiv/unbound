//! Images and icons compiled into the binary, so it runs from any directory.

use std::borrow::Cow;

use gpui::{AssetSource, SharedString};

pub const LOGO: &str = "logo.png";
pub const SEARCH: &str = "icons/search.svg";
pub const CHEVRON_UP: &str = "icons/chevron-up.svg";
pub const CHEVRON_DOWN: &str = "icons/chevron-down.svg";

const FILES: &[(&str, &[u8])] = &[
	(LOGO, include_bytes!("../../../../../assets/logo.png")),
	(SEARCH, include_bytes!("../assets/icons/search.svg")),
	(CHEVRON_UP, include_bytes!("../assets/icons/chevron-up.svg")),
	(
		CHEVRON_DOWN,
		include_bytes!("../assets/icons/chevron-down.svg"),
	),
];

pub struct Assets;

impl AssetSource for Assets {
	fn load(&self, path: &str) -> gpui::Result<Option<Cow<'static, [u8]>>> {
		Ok(FILES
			.iter()
			.find(|(name, _)| *name == path)
			.map(|(_, bytes)| Cow::Borrowed(*bytes)))
	}

	fn list(&self, path: &str) -> gpui::Result<Vec<SharedString>> {
		Ok(FILES
			.iter()
			.filter(|(name, _)| name.starts_with(path))
			.map(|(name, _)| SharedString::from(*name))
			.collect())
	}
}
