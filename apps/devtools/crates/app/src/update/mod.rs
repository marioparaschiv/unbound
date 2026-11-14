//! The updater: checks the API for a newer release at startup (when the setting allows) or on
//! demand, shows a toast when one is found, and installs it over the running executable. One
//! global holds its state, so the toast and the settings section show the same thing.

mod api;
mod install;
pub mod toast;

use gpui::{App, BorrowAppContext as _, Global, SharedString};

pub use self::api::{Update, VERSION};
pub use self::install::clean_up;
use self::toast::{Action, Toast};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Status {
	Idle,
	Checking,
	Current,
	Available(Update),
	Installing(Update),
	/// Installed; takes effect once DevTools restarts.
	Installed(String),
	Failed(SharedString),
}

pub struct Updater {
	pub status: Status,
}

impl Global for Updater {}

pub fn init(cx: &mut App) {
	cx.set_global(Updater {
		status: Status::Idle,
	});
	toast::init(cx);
}

pub fn status(cx: &App) -> &Status {
	&cx.global::<Updater>().status
}

fn set(status: Status, cx: &mut App) {
	cx.update_global::<Updater, _>(|updater, _| updater.status = status);
}

fn busy(cx: &App) -> bool {
	matches!(status(cx), Status::Checking | Status::Installing(_))
}

/// Asks the API for a newer release. `quiet` keeps a check that finds nothing, or fails, out of
/// toasts, as the startup check does; the settings section shows the outcome either way.
pub fn check(quiet: bool, cx: &mut App) {
	if busy(cx) {
		return;
	}
	set(Status::Checking, cx);
	let task = cx.background_executor().spawn(async move { api::check() });
	cx.spawn(async move |cx| {
		let result = task.await;
		cx.update(|cx| {
			let status = match result {
				Ok(Some(update)) => {
					toast::show(available(&update), cx);
					Status::Available(update)
				}
				Ok(None) => {
					if !quiet {
						toast::show(
							note(
								"No updates",
								format!("DevTools {VERSION} is the newest version."),
							),
							cx,
						);
					}
					Status::Current
				}
				Err(error) => {
					tracing::warn!("Failed to check for DevTools updates: {error:#}");
					let message = SharedString::from(format!("{error:#}"));
					if !quiet {
						toast::show(note("Couldn't check for updates", message.clone()), cx);
					}
					Status::Failed(message)
				}
			};
			set(status, cx);
		});
	})
	.detach();
}

/// Downloads and installs the update the last check found.
pub fn install(cx: &mut App) {
	let Status::Available(update) = status(cx).clone() else {
		return;
	};
	set(Status::Installing(update.clone()), cx);
	toast::show(
		Toast {
			title: "Updating".into(),
			message: format!("Downloading DevTools {}...", update.version).into(),
			action: None,
			// Stays until the install's outcome takes its place.
			stays: true,
		},
		cx,
	);
	let job = update.clone();
	let task = cx
		.background_executor()
		.spawn(async move { install::install(&job) });
	cx.spawn(async move |cx| {
		let result = task.await;
		cx.update(|cx| match result {
			Ok(()) => {
				toast::show(installed(&update.version), cx);
				set(Status::Installed(update.version), cx);
			}
			Err(error) => {
				tracing::error!("Failed to install DevTools {}: {error:#}", update.version);
				let message = format!("{error:#}");
				toast::show(note("Couldn't install the update", message), cx);
				// Back to available, so Update can be retried.
				set(Status::Available(update), cx);
			}
		});
	})
	.detach();
}

/// Starts the installed version and quits this one.
pub fn restart(cx: &mut App) {
	match install::relaunch() {
		Ok(()) => cx.quit(),
		Err(error) => {
			tracing::error!("Failed to restart DevTools: {error:#}");
			toast::show(note("Couldn't restart DevTools", format!("{error:#}")), cx);
		}
	}
}

fn available(update: &Update) -> Toast {
	Toast {
		title: "Update available".into(),
		message: format!(
			"DevTools {} is available. You have {VERSION}.",
			update.version
		)
		.into(),
		action: Some(Action {
			id: "install-update",
			icon: "icons/download.svg",
			label: "Update",
			run: install,
		}),
		stays: true,
	}
}

fn installed(version: &str) -> Toast {
	Toast {
		title: "Update installed".into(),
		message: format!("DevTools {version} is installed. Restart to use it.").into(),
		action: Some(Action {
			id: "restart-update",
			icon: "icons/rotate-cw.svg",
			label: "Restart",
			run: restart,
		}),
		stays: true,
	}
}

/// A passing message with no action; it slides out on its own.
fn note(title: &'static str, message: impl Into<SharedString>) -> Toast {
	Toast {
		title: title.into(),
		message: message.into(),
		action: None,
		stays: false,
	}
}
