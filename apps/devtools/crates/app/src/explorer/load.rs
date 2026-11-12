//! What the explorer asks the device for: the page's object, a page of a section's members, and
//! the values of the members on screen. Every answer checks the page's epoch, so one that lands
//! after a navigation is dropped.

use std::collections::BTreeMap;
use std::rc::Rc;

use gpui::Context;
use unbound_devtools_core::{
	EXPLORER_VALUES_LIMIT, ExplorerError, ExplorerMemberKind, ExplorerObject, ExplorerRead,
	ExplorerTarget, MembersPage,
};

use super::rows::Item;
use super::{Explorer, ExplorerHost, Load, Section, VALUES_DEBOUNCE, ValueState};
use crate::app::on_runtime;

/// Rows a screen can show at most, past the first visible one, when the list has not laid out.
const SCREEN_ROWS: usize = 48;

fn cancelled() -> ExplorerError {
	ExplorerError::Device {
		code: unbound_devtools_core::ExplorerErrorCode::Failed,
		message: "The request was cancelled.".into(),
	}
}

impl Explorer {
	pub(super) fn request_object<H: ExplorerHost>(&mut self, cx: &mut Context<H>) {
		let Some(target) = self.history.current().map(|entry| entry.target.clone()) else {
			return;
		};
		// A reload keeps the page on show until the answer replaces it.
		if !matches!(self.object, Some(Load::Loaded(_))) {
			self.object = Some(Load::Loading);
		}
		self.rebuild();
		let epoch = self.epoch;
		let request = on_runtime(&self.devtools, {
			let devtools = self.devtools.clone();
			async move { devtools.explorer_object(&target).await }
		});
		cx.spawn(async move |this, cx| {
			let result = request.await.unwrap_or_else(|| Err(cancelled()));
			this.update(cx, |host, cx| {
				let explorer = host.explorer_mut();
				if explorer.epoch == epoch {
					explorer.settle_object(result, cx);
				}
			})
			.ok();
		})
		.detach();
		cx.notify();
	}

	fn settle_object<H: ExplorerHost>(
		&mut self,
		result: Result<ExplorerObject, ExplorerError>,
		cx: &mut Context<H>,
	) {
		let object = match result {
			Ok(object) => object,
			Err(error) => {
				// The object is gone, as after a reload: its class still describes it.
				let class = self
					.history
					.current()
					.and_then(|entry| entry.class_name.clone());
				if let (true, Some(class)) = (error.is_stale(), class) {
					if let Some(entry) = self.history.current_mut() {
						entry.target = ExplorerTarget::ClassName(class);
					}
					self.fell_back = true;
					self.request_object(cx);
					return;
				}
				tracing::warn!("Failed to open {:?}: {error}", self.history.current());
				self.object = Some(Load::Failed(error));
				self.rebuild();
				cx.notify();
				return;
			}
		};
		// A view's node is renumbered when the tree is listed again; its ref outlives that.
		if let Some(entry) = self.history.current_mut() {
			if let (ExplorerTarget::Node(_), Some(object_ref)) = (&entry.target, &object.object_ref)
			{
				entry.target = ExplorerTarget::Object(object_ref.clone());
			}
			entry.class_name = Some(object.class_name.clone());
		}
		if self.expanded.is_empty()
			&& let Some(own) = object.chain.first()
		{
			self.expanded.insert(own.name.clone());
			let kinds = object.platform.kinds();
			let first = kinds
				.iter()
				.copied()
				.find(|kind| own.counts.get(kind).is_some_and(|count| *count > 0))
				.or(kinds.first().copied());
			if let Some(kind) = first {
				self.open.insert((own.name.clone(), kind));
			}
		}
		self.object = Some(Load::Loaded(Rc::new(object)));
		let open: Vec<_> = self.open.iter().cloned().collect();
		for (class, kind) in open {
			self.ensure_section(&class, kind, cx);
		}
		self.rebuild();
		self.schedule_values(cx);
		cx.notify();
	}

	/// Lists the first page of a section for the current filter, unless it is listed or listing.
	pub(super) fn ensure_section<H: ExplorerHost>(
		&mut self,
		class: &str,
		kind: ExplorerMemberKind,
		cx: &mut Context<H>,
	) {
		let key = (class.to_owned(), kind, self.filter.clone());
		if matches!(
			self.sections.get(&key),
			Some(Load::Loading | Load::Loaded(_))
		) {
			return;
		}
		self.sections.insert(key, Load::Loading);
		self.request_members(class, kind, 0, cx);
	}

	/// Lists the page after a section's listed members.
	pub(super) fn show_more<H: ExplorerHost>(
		&mut self,
		class: &str,
		kind: ExplorerMemberKind,
		cx: &mut Context<H>,
	) {
		let key = (class.to_owned(), kind, self.filter.clone());
		let Some(Load::Loaded(section)) = self.sections.get_mut(&key) else {
			return;
		};
		if matches!(section.next, Some(Ok(()))) {
			return;
		}
		section.next = Some(Ok(()));
		let offset = section.members.len() as u32;
		self.request_members(class, kind, offset, cx);
		self.rebuild();
		cx.notify();
	}

	/// Lists a section again after it failed.
	pub(super) fn retry_section<H: ExplorerHost>(
		&mut self,
		class: &str,
		kind: ExplorerMemberKind,
		cx: &mut Context<H>,
	) {
		self.sections
			.remove(&(class.to_owned(), kind, self.filter.clone()));
		self.ensure_section(class, kind, cx);
		self.rebuild();
		cx.notify();
	}

	fn request_members<H: ExplorerHost>(
		&mut self,
		class: &str,
		kind: ExplorerMemberKind,
		offset: u32,
		cx: &mut Context<H>,
	) {
		let epoch = self.epoch;
		let key = (class.to_owned(), kind, self.filter.clone());
		let request = on_runtime(&self.devtools, {
			let devtools = self.devtools.clone();
			let (class, filter) = (key.0.clone(), key.2.clone());
			async move {
				devtools
					.explorer_members(&class, kind, offset, &filter)
					.await
			}
		});
		cx.spawn(async move |this, cx| {
			let result = request.await.unwrap_or_else(|| Err(cancelled()));
			this.update(cx, |host, cx| {
				let explorer = host.explorer_mut();
				if explorer.epoch == epoch {
					explorer.settle_members(key, result, cx);
				}
			})
			.ok();
		})
		.detach();
	}

	fn settle_members<H: ExplorerHost>(
		&mut self,
		key: (String, ExplorerMemberKind, String),
		result: Result<MembersPage, ExplorerError>,
		cx: &mut Context<H>,
	) {
		if let Err(error) = &result {
			tracing::warn!("Failed to list the {:?} of {}: {error}", key.1, key.0);
		}
		let section = match (self.sections.remove(&key), result) {
			(Some(Load::Loaded(mut section)), Ok(page)) => {
				section
					.members
					.extend(page.members.into_iter().map(Rc::new));
				section.total = page.total;
				section.next = None;
				Load::Loaded(section)
			}
			(Some(Load::Loaded(mut section)), Err(error)) => {
				section.next = Some(Err(error));
				Load::Loaded(section)
			}
			(_, Ok(page)) => Load::Loaded(Section {
				members: page.members.into_iter().map(Rc::new).collect(),
				total: page.total,
				next: None,
			}),
			(_, Err(error)) => Load::Failed(error),
		};
		self.sections.insert(key, section);
		self.rebuild();
		self.schedule_values(cx);
		cx.notify();
	}

	/// Reads the values on screen once scrolling has rested.
	pub(super) fn schedule_values<H: ExplorerHost>(&mut self, cx: &mut Context<H>) {
		if self.object_ref().is_none() {
			return;
		}
		self.values_task = Some(cx.spawn(async move |this, cx| {
			cx.background_executor().timer(VALUES_DEBOUNCE).await;
			this.update(cx, |host, cx| host.explorer_mut().read_visible_values(cx))
				.ok();
		}));
	}

	/// Asks for the values of the rows on screen that read on their own and are not read yet, in
	/// batches of one class and kind.
	fn read_visible_values<H: ExplorerHost>(&mut self, cx: &mut Context<H>) {
		let first = self.list.logical_scroll_top().item_ix;
		let height = f32::from(self.list.viewport_bounds().size.height);
		let rows = if height > 0. {
			(height / f32::from(crate::theme::VALUE_ROW_HEIGHT)).ceil() as usize + 2
		} else {
			SCREEN_ROWS
		};
		let mut batches: BTreeMap<(String, ExplorerMemberKind), Vec<String>> = BTreeMap::new();
		for item in self.items.iter().skip(first).take(rows) {
			let Item::Member { class, kind, index } = item else {
				continue;
			};
			let Some(member) = self.member(class, *kind, *index) else {
				continue;
			};
			let key = (class.clone(), *kind, member.name.clone());
			if kind.has_values()
				&& member.read == ExplorerRead::Auto
				&& !self.values.contains_key(&key)
			{
				batches
					.entry((class.clone(), *kind))
					.or_default()
					.push(member.name.clone());
			}
		}
		for ((class, kind), names) in batches {
			for chunk in names.chunks(EXPLORER_VALUES_LIMIT) {
				self.request_values(&class, kind, chunk.to_vec(), false, cx);
			}
		}
	}

	/// Reads one member whose getter runs code, because the user asked.
	pub(super) fn read_value<H: ExplorerHost>(
		&mut self,
		class: &str,
		kind: ExplorerMemberKind,
		name: &str,
		cx: &mut Context<H>,
	) {
		self.request_values(class, kind, vec![name.to_owned()], true, cx);
	}

	fn request_values<H: ExplorerHost>(
		&mut self,
		class: &str,
		kind: ExplorerMemberKind,
		names: Vec<String>,
		invoke_getters: bool,
		cx: &mut Context<H>,
	) {
		let Some(object) = self.object_ref().map(str::to_owned) else {
			return;
		};
		for name in &names {
			self.values
				.insert((class.to_owned(), kind, name.clone()), ValueState::Loading);
		}
		let epoch = self.epoch;
		let class = class.to_owned();
		let request = on_runtime(&self.devtools, {
			let devtools = self.devtools.clone();
			let (class, names) = (class.clone(), names.clone());
			async move {
				devtools
					.explorer_values(&object, &class, kind, &names, invoke_getters)
					.await
			}
		});
		cx.spawn(async move |this, cx| {
			let result = request.await.unwrap_or_else(|| Err(cancelled()));
			this.update(cx, |host, cx| {
				let explorer = host.explorer_mut();
				if explorer.epoch != epoch {
					return;
				}
				match result {
					Ok(values) => {
						for value in values {
							let key = (class.clone(), kind, value.name.clone());
							explorer.values.insert(key, ValueState::Loaded(value));
						}
						for name in names {
							explorer
								.values
								.entry((class.clone(), kind, name))
								.and_modify(|state| {
									if matches!(state, ValueState::Loading) {
										*state = ValueState::Failed("No value".into());
									}
								});
						}
					}
					// The object went away under the page: show its class instead.
					Err(error) if error.is_stale() => explorer.reload(cx),
					Err(error) => {
						tracing::warn!("Failed to read the {kind:?} of {class}: {error}");
						for name in names {
							let state = ValueState::Failed(error.to_string());
							explorer.values.insert((class.clone(), kind, name), state);
						}
					}
				}
				cx.notify();
			})
			.ok();
		})
		.detach();
		cx.notify();
	}
}
