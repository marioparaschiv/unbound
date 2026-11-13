//! Keys mode: the device walks the loaded modules' exports, their properties and prototypes, for
//! keys and function names containing the query. It answers in short batches; the page asks for the
//! next one until it holds a page of new matches, then waits for Search More.

use gpui::Context;
use unbound_devtools_core::{METRO_SEARCH_PAGE_SIZE, MetroError, MetroMatch, SearchPage};

use super::reveal::Reveal;
use super::{Exports, MetroBrowser, Row, cancelled};
use crate::app::on_runtime;

/// The matches so far, and where the device continues.
pub(super) struct KeySearch {
	pub matches: Vec<MetroMatch>,
	/// `None` once every loaded module is searched.
	pub cursor: Option<u32>,
	pub searched: u32,
	pub total: u32,
	/// How many matches there were when this page began; batches continue until a page past it.
	page_start: usize,
	pub running: bool,
	pub error: Option<MetroError>,
}

impl MetroBrowser {
	/// Searches for the query from the start, or with `more`, continues from the last cursor.
	pub(super) fn search_keys(&mut self, more: bool, cx: &mut Context<Self>) {
		if self.query.is_empty() {
			self.epoch += 1;
			self.keys = None;
			self.rebuild_rows();
			cx.notify();
			return;
		}
		if !more || self.keys.is_none() {
			self.epoch += 1;
			self.keys = Some(KeySearch {
				matches: Vec::new(),
				cursor: Some(0),
				searched: 0,
				total: 0,
				page_start: 0,
				running: false,
				error: None,
			});
		}
		let Some(keys) = &mut self.keys else {
			return;
		};
		let Some(cursor) = keys.cursor else {
			return;
		};
		keys.page_start = keys.matches.len();
		keys.running = true;
		keys.error = None;
		self.search_batch(cursor, cx);
	}

	fn search_batch(&mut self, cursor: u32, cx: &mut Context<Self>) {
		let epoch = self.epoch;
		let query = self.query.clone();
		let request = on_runtime(&self.devtools, {
			let devtools = self.devtools.clone();
			async move { devtools.metro_search(&query, cursor).await }
		});
		cx.spawn(async move |this, cx| {
			let result = request.await.unwrap_or_else(|| Err(cancelled()));
			this.update(cx, |this, cx| {
				if this.epoch == epoch {
					this.settle_search(result, cx);
				}
			})
			.ok();
		})
		.detach();
		self.rebuild_rows();
		cx.notify();
	}

	fn settle_search(&mut self, result: Result<SearchPage, MetroError>, cx: &mut Context<Self>) {
		let Some(keys) = &mut self.keys else {
			return;
		};
		let mut next = None;
		match result {
			Ok(page) => {
				keys.matches.extend(page.matches);
				keys.cursor = page.cursor;
				keys.searched = page.searched;
				keys.total = page.total;
				let found = keys.matches.len() - keys.page_start;
				next = keys
					.cursor
					.filter(|_| found < METRO_SEARCH_PAGE_SIZE as usize);
			}
			Err(error) => {
				tracing::warn!(
					"Failed to search the Metro keys for {}: {error}",
					self.query
				);
				keys.error = Some(error);
			}
		}
		keys.running = next.is_some();
		match next {
			Some(cursor) => self.search_batch(cursor, cx),
			None => {
				self.rebuild_rows();
				cx.notify();
			}
		}
	}

	/// The list rows in Keys mode.
	pub(super) fn key_rows(&self) -> Vec<Row> {
		let Some(keys) = &self.keys else {
			return vec![Row::Note("Type a Key or Function Name".into(), false)];
		};
		let mut rows: Vec<Row> = (0..keys.matches.len()).map(Row::Match).collect();
		if keys.running {
			rows.push(Row::Note(
				format!("Searching… {} of {} Modules", keys.searched, keys.total).into(),
				false,
			));
		} else if let Some(error) = &keys.error {
			rows.push(Row::Note(error.to_string().into(), true));
		} else if keys.cursor.is_some() {
			rows.push(Row::SearchMore);
		} else if keys.matches.is_empty() {
			rows.push(Row::Note("Nothing Matches".into(), false));
		}
		rows
	}

	/// Shows match `ix`'s whole module on the right and opens its tree down to the match. A module
	/// already open keeps its tree, so the reveal continues from what is open.
	pub(super) fn pick_match(&mut self, ix: usize, cx: &mut Context<Self>) {
		let Some(found) = self
			.keys
			.as_ref()
			.and_then(|keys| keys.matches.get(ix))
			.cloned()
		else {
			return;
		};
		let open = self.picked.as_ref().is_some_and(|picked| {
			picked.module.id == found.module.id && matches!(picked.exports, Exports::Loaded(_))
		});
		if !open {
			self.pick(found.module.clone(), cx);
		}
		let Some(picked) = self.picked.as_mut() else {
			return;
		};
		picked.target = Some(found.path.clone());
		picked.reveal = Some(Reveal {
			keys: found.path,
			at: Vec::new(),
		});
		if open {
			self.advance_reveal(cx);
		}
		cx.notify();
	}
}

/// The keys before the matched one, ending in ` › `; empty for a match on the exports or a top key.
pub(super) fn path_prefix(found: &MetroMatch) -> String {
	let parents = found.path.len().saturating_sub(1);
	found.path[..parents]
		.iter()
		.map(|key| format!("{key} › "))
		.collect()
}
