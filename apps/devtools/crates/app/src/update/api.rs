//! The update check: asks `GET /api/v1/devtools/updates` for the newest release built for this
//! machine's target. Blocking; run it off the main thread.

use std::time::Duration;

use anyhow::Context as _;
use serde::Deserialize;

/// The API that registers releases; `UNBOUND_API_URL` points a test build elsewhere.
const DEFAULT_API_URL: &str = "https://unbound.rip";
const TIMEOUT: Duration = Duration::from_secs(15);

/// The running build's version, as the API compares it.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// A newer release, with this target's archive and its SHA-256.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
pub struct Update {
	pub version: String,
	pub url: String,
	pub sha256: String,
	pub changelog: Option<String>,
}

#[derive(Deserialize)]
struct Response {
	update: Option<Update>,
}

/// The API's `<os>-<arch>` name for this build, or `None` on a platform no release is built for.
pub fn target() -> Option<&'static str> {
	match (std::env::consts::OS, std::env::consts::ARCH) {
		("macos", "aarch64") => Some("macos-arm64"),
		("windows", "x86_64") => Some("windows-x64"),
		("windows", "aarch64") => Some("windows-arm64"),
		("linux", "x86_64") => Some("linux-x64"),
		("linux", "aarch64") => Some("linux-arm64"),
		_ => None,
	}
}

pub fn agent() -> ureq::Agent {
	ureq::Agent::config_builder()
		.timeout_global(Some(TIMEOUT))
		.user_agent(format!("unbound-devtools/{VERSION}"))
		.build()
		.into()
}

fn api_url() -> String {
	let base = std::env::var("UNBOUND_API_URL").unwrap_or_else(|_| DEFAULT_API_URL.to_owned());
	format!("{}/api/v1/devtools/updates", base.trim_end_matches('/'))
}

/// The newest release this install may move to, or `None` when it is current.
pub fn check() -> anyhow::Result<Option<Update>> {
	let target = target().context("No DevTools release is built for this platform")?;
	let body = agent()
		.get(api_url())
		.query("target", target)
		.query("version", VERSION)
		.call()
		.context("Failed to reach the update server")?
		.into_body()
		.read_to_string()
		.context("Failed to read the update server's answer")?;
	parse(&body)
}

fn parse(body: &str) -> anyhow::Result<Option<Update>> {
	let response: Response =
		serde_json::from_str(body).context("The update server answered with an unknown shape")?;
	Ok(response.update)
}

#[cfg(test)]
mod tests {
	use super::{Update, parse, target};

	#[test]
	fn reads_an_update_and_a_current_install() {
		let body = r#"{"update":{"version":"1.2.0","url":"https://example.com/a.tar.gz","sha256":"ab","changelog":null,"publishedAt":"2026-11-13T12:00:00.000Z","changelogs":[]}}"#;
		assert_eq!(
			parse(body).unwrap(),
			Some(Update {
				version: "1.2.0".into(),
				url: "https://example.com/a.tar.gz".into(),
				sha256: "ab".into(),
				changelog: None,
			})
		);
		assert_eq!(parse(r#"{"update":null}"#).unwrap(), None);
		assert!(parse("<html>").is_err());
	}

	#[test]
	fn names_every_released_target() {
		// CI builds these five; any other host has no release to move to.
		if let Some(target) = target() {
			assert!(
				[
					"macos-arm64",
					"windows-x64",
					"windows-arm64",
					"linux-x64",
					"linux-arm64"
				]
				.contains(&target)
			);
		}
	}
}
