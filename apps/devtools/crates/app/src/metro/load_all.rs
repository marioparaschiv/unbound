//! Load All: the device runs the modules that have not loaded in short batches, skipping its
//! blacklist of modules that threw, and the page asks for the next batch until none remain or Stop.

use gpui::Context;
use unbound_devtools_core::{LoadAllBatch, MetroError};

use super::{MetroBrowser, Mode, cancelled};
use crate::app::on_runtime;

/// A Load All while it runs.
pub(super) struct LoadAll {
	/// Modules still to run, once the first batch has answered.
	pub remaining: Option<u32>,
	pub failed: u32,
	/// Stop was clicked; the batch in flight finishes first.
	pub stopping: bool,
}

impl MetroBrowser {
	pub(super) fn start_load_all(&mut self, cx: &mut Context<Self>) {
		if self.load_all.is_some() {
			return;
		}
		self.load_all = Some(LoadAll {
			remaining: None,
			failed: 0,
			stopping: false,
		});
		self.load_note = None;
		self.load_all_batch(cx);
	}

	pub(super) fn stop_load_all(&mut self, cx: &mut Context<Self>) {
		if let Some(run) = &mut self.load_all {
			run.stopping = true;
			cx.notify();
		}
	}

	fn load_all_batch(&mut self, cx: &mut Context<Self>) {
		let request = on_runtime(&self.devtools, {
			let devtools = self.devtools.clone();
			async move { devtools.metro_load_all().await }
		});
		cx.spawn(async move |this, cx| {
			let result = request.await.unwrap_or_else(|| Err(cancelled()));
			this.update(cx, |this, cx| this.settle_load_all(result, cx))
				.ok();
		})
		.detach();
		cx.notify();
	}

	fn settle_load_all(
		&mut self,
		result: Result<LoadAllBatch, MetroError>,
		cx: &mut Context<Self>,
	) {
		// A disconnect drops the run; this batch's answer has nowhere to go.
		let Some(run) = &mut self.load_all else {
			return;
		};
		let note = match result {
			Ok(batch) => {
				self.counts = Some((batch.loaded, batch.count));
				run.failed += batch.failed;
				run.remaining = Some(batch.remaining);
				let done = batch.remaining == 0 || batch.attempted == 0;
				if !done && !run.stopping {
					self.load_all_batch(cx);
					return;
				}
				let threw = run.failed;
				if done {
					format!("Loaded All · {threw} Threw")
				} else {
					format!("Stopped · {} Left · {threw} Threw", batch.remaining)
				}
			}
			Err(error) => {
				tracing::warn!("Failed to load all the Metro modules: {error}");
				format!("Load All Stopped: {error}")
			}
		};
		self.load_all = None;
		self.load_note = Some(note);
		// Statuses, labels and file paths changed under the listing.
		match self.mode {
			Mode::Modules => self.list(0, cx),
			Mode::Files => self.fetch_files(cx),
			Mode::Keys => {}
		}
		cx.notify();
	}
}
