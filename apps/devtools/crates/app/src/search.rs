use std::collections::HashSet;
use std::time::Duration;

use gpui::{Context, Task};
use serde_json::Value as Json;
use unbound_devtools_core::query::{find, run_jq_on_tree};
use unbound_devtools_core::{Devtools, ElementId, FindQuery, NameMatch};

use crate::app::Workspace;

enum Mode {
	Empty,
	Name(String),
	Jq(String),
}

impl Mode {
	fn parse(query: &str) -> Self {
		let query = query.trim();
		if query.is_empty() {
			Mode::Empty
		} else if let Some(program) = query.strip_prefix("jq:") {
			Mode::Jq(program.trim().to_string())
		} else if query.starts_with('.') {
			Mode::Jq(query.to_string())
		} else {
			Mode::Name(query.to_string())
		}
	}
}

#[derive(Default)]
pub struct Search {
	pub query: String,
	pub matches: Vec<ElementId>,
	pub set: HashSet<ElementId>,
	pub active: Option<usize>,
	pub error: Option<String>,
	select_first: bool,
	task: Option<Task<()>>,
}

impl Search {
	pub fn is_active(&self) -> bool {
		!matches!(Mode::parse(&self.query), Mode::Empty)
	}

	pub fn set_query(&mut self, query: String, devtools: Devtools, cx: &mut Context<Workspace>) {
		let delay = match Mode::parse(&query) {
			Mode::Jq(_) => Duration::from_millis(200),
			_ => Duration::ZERO,
		};
		self.query = query;
		self.schedule(devtools, delay, true, cx);
	}

	pub fn schedule(
		&mut self,
		devtools: Devtools,
		delay: Duration,
		select_first: bool,
		cx: &mut Context<Workspace>,
	) {
		self.select_first |= select_first;
		let mode = Mode::parse(&self.query);
		if matches!(mode, Mode::Empty) {
			*self = Search {
				query: std::mem::take(&mut self.query),
				..Search::default()
			};
			cx.notify();
			return;
		}
		self.task = Some(cx.spawn(async move |this, cx| {
			if !delay.is_zero() {
				cx.background_executor().timer(delay).await;
			}
			let result = match mode {
				Mode::Empty => Ok(Vec::new()),
				Mode::Name(name) => {
					let query = FindQuery {
						name: Some(NameMatch::Contains(name)),
						..FindQuery::default()
					};
					Ok(find(&devtools.store(), &query))
				}
				Mode::Jq(program) => {
					cx.background_executor()
						.spawn(async move { jq_matches(&devtools, &program) })
						.await
				}
			};
			this.update(cx, |this, cx| this.search_finished(result, cx))
				.ok();
		}));
	}

	pub fn step(&mut self, forward: bool) -> Option<ElementId> {
		let len = self.matches.len();
		if len == 0 {
			return None;
		}
		let next = match self.active {
			None if forward => 0,
			None => len - 1,
			Some(ix) if forward => (ix + 1) % len,
			Some(ix) => (ix + len - 1) % len,
		};
		self.active = Some(next);
		Some(self.matches[next])
	}
}

impl Workspace {
	fn search_finished(&mut self, result: Result<Vec<ElementId>, String>, cx: &mut Context<Self>) {
		let search = &mut self.search;
		search.task = None;
		let select_first = std::mem::take(&mut search.select_first);
		match result {
			Ok(ids) => {
				search.error = None;
				search.set = ids.iter().copied().collect();
				search.matches = ids;
			}
			Err(error) => {
				search.error = Some(error);
				search.set.clear();
				search.matches.clear();
			}
		}
		search.active = self
			.synced_selection
			.and_then(|id| search.matches.iter().position(|&m| m == id));
		if select_first && search.active.is_none() {
			self.step_match(true, cx);
		}
		cx.notify();
	}
}

fn jq_matches(devtools: &Devtools, program: &str) -> Result<Vec<ElementId>, String> {
	let outputs = run_jq_on_tree(devtools, None, program, |output| match output {
		Json::Number(n) => n.as_i64(),
		Json::Object(object) => object.get("id").and_then(Json::as_i64),
		_ => None,
	})?;
	let mut seen = HashSet::new();
	Ok(outputs
		.into_iter()
		.flatten()
		.map(ElementId)
		.filter(|id| seen.insert(*id))
		.collect())
}
