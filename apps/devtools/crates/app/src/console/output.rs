//! A console result as lines, with the values its preview left folded (`{…}`, `Set(2) […]`) opening
//! in place. An open value's preview replaces its fold: its first line continues the line it sat on,
//! and the rest grow in below on the accordion's curve, indented to that line.

use std::collections::HashSet;
use std::ops::Range;
use std::rc::Rc;

use gpui::{AnyElement, Context, SharedString, div, prelude::*, px};
use serde_json::Value;
use unbound_devtools_repl::device::Preview;

use super::Console;
use super::highlight::{Highlighted, Piece};
use crate::accordion::Accordion;
use crate::theme;
use crate::widgets::turning_chevron;

/// What a folded value's own preview is, as far as the device has answered.
pub enum Content {
	Unread,
	Loading,
	Ready(Output),
	Failed(SharedString),
}

/// A value a preview folded.
pub struct Fold {
	pub id: u64,
	/// Its text in the preview, on line `line`.
	range: Range<usize>,
	line: usize,
	/// The steps to it from `$n`.
	pub path: Rc<[Value]>,
	pub content: Content,
}

/// A preview as lines, with its folds.
pub struct Output {
	text: Highlighted,
	lines: Vec<Range<usize>>,
	folds: Vec<Fold>,
}

/// What drawing needs besides the output: which folds are open, and how far each one has moved.
pub struct Folds<'a> {
	pub n: u32,
	pub open: &'a HashSet<u64>,
	pub motion: &'a Accordion<u64>,
	/// One monospace character's width, to put a chevron in the indent before its line.
	pub char: f32,
}

impl Folds<'_> {
	fn shows(&self, id: u64) -> bool {
		self.motion.shows(&id, self.open.contains(&id))
	}

	fn turn(&self, id: u64) -> f32 {
		self.motion.progress(&id, self.open.contains(&id))
	}
}

impl Output {
	/// `preview`'s lines and folds; each fold's path continues `base`, and takes the next id.
	pub fn new(preview: Preview, base: &[Value], next_id: &mut u64) -> Self {
		let text = preview.text;
		let mut lines = Vec::new();
		let mut start = 0;
		for (at, _) in text.match_indices('\n') {
			lines.push(start..at);
			start = at + 1;
		}
		lines.push(start..text.len());
		let folds = preview
			.folds
			.into_iter()
			.filter_map(|fold| {
				let line = lines
					.iter()
					.position(|line| line.contains(&fold.range.start))?;
				*next_id += 1;
				Some(Fold {
					id: *next_id,
					range: fold.range,
					line,
					path: base.iter().chain(&fold.path).cloned().collect(),
					content: Content::Unread,
				})
			})
			.collect();
		Self {
			text: Highlighted::new(text),
			lines,
			folds,
		}
	}

	/// The fold `id`, here or inside an opened one.
	pub fn find(&mut self, id: u64) -> Option<&mut Fold> {
		self.folds.iter_mut().find_map(|fold| {
			if fold.id == id {
				return Some(fold);
			}
			match &mut fold.content {
				Content::Ready(inner) => inner.find(id),
				_ => None,
			}
		})
	}

	/// This output's folds not yet asked for, marked as asked: the next level to prefetch.
	pub fn take_unread(&mut self) -> Vec<(u64, Rc<[Value]>)> {
		self.folds
			.iter_mut()
			.filter(|fold| matches!(fold.content, Content::Unread))
			.map(|fold| {
				fold.content = Content::Loading;
				(fold.id, fold.path.clone())
			})
			.collect()
	}

	pub fn render(&mut self, folds: &Folds, cx: &mut Context<Console>) -> Vec<AnyElement> {
		self.rows(Piece::default(), Piece::default(), "", None, folds, cx)
	}

	/// The output's rows: `lead` starts its first line, `tail` ends its last, `indent` starts the
	/// others, and `marker` is the fold whose chevron the first line carries.
	fn rows(
		&mut self,
		lead: Piece,
		tail: Piece,
		indent: &str,
		marker: Option<u64>,
		folds: &Folds,
		cx: &mut Context<Console>,
	) -> Vec<AnyElement> {
		self.text.refresh(cx);
		let Self {
			text,
			lines,
			folds: spots,
		} = self;
		let last = lines.len().saturating_sub(1);
		let mut out = Vec::new();
		for (ix, range) in lines.iter().enumerate() {
			let mut piece = if ix == 0 {
				lead.clone()
			} else {
				Piece::plain(indent)
			};
			let end = if ix == last {
				tail.clone()
			} else {
				Piece::default()
			};
			let spot = spots.iter_mut().find(|fold| fold.line == ix);
			let Some(fold) = spot.filter(|fold| folds.shows(fold.id)) else {
				piece.push(&text.slice(range.clone()));
				piece.push(&end);
				let mark = spots
					.iter()
					.find(|fold| fold.line == ix)
					.map(|fold| fold.id)
					.or(marker.filter(|_| ix == 0));
				out.push(row(piece, mark, folds, cx));
				continue;
			};
			let id = fold.id;
			match &mut fold.content {
				Content::Ready(inner) => {
					piece.push(&text.slice(range.start..fold.range.start));
					let mut inner_tail = text.slice(fold.range.end..range.end);
					inner_tail.push(&end);
					let spaces = text.text()[range.clone()]
						.chars()
						.take_while(|c| *c == ' ')
						.count();
					let inner_indent = format!("{indent}{}", " ".repeat(spaces));
					let mut rows =
						inner.rows(piece, inner_tail, &inner_indent, Some(id), folds, cx);
					let first = rows.remove(0);
					out.push(first);
					if !rows.is_empty() {
						let block = div().flex().flex_col().children(rows);
						out.push(folds.motion.block(&id, block));
					}
				}
				content => {
					let note = match content {
						Content::Failed(error) => Some(error.clone()),
						_ => None,
					};
					piece.push(&text.slice(range.clone()));
					piece.push(&end);
					out.push(row(piece, Some(id), folds, cx));
					if let Some(error) = note {
						let block = div()
							.text_color(theme::color(theme::ERROR))
							.child(format!("{indent}    {error}"));
						out.push(folds.motion.block(&id, block));
					}
				}
			}
		}
		out
	}
}

/// A line of the output; one that carries a fold's chevron opens or closes it on click.
fn row(piece: Piece, marker: Option<u64>, folds: &Folds, cx: &mut Context<Console>) -> AnyElement {
	let Some(id) = marker else {
		return div().child(piece.styled()).into_any_element();
	};
	// The chevron sits in the indent's last two columns.
	let spaces = piece.text.chars().take_while(|c| *c == ' ').count();
	let left = spaces.saturating_sub(2) as f32 * folds.char;
	let n = folds.n;
	div()
		.id(("console-fold", id as usize))
		.relative()
		.rounded(px(4.))
		.cursor_pointer()
		.hover(|row| row.bg(theme::color(theme::HOVER)))
		.child(piece.styled())
		.child(
			div()
				.absolute()
				.top_0()
				.bottom_0()
				.left(px(left))
				.w(px(2. * folds.char))
				.flex()
				.items_center()
				.justify_center()
				.child(turning_chevron(folds.turn(id))),
		)
		.on_click(cx.listener(move |this, _, _, cx| this.toggle_fold(n, id, cx)))
		.into_any_element()
}
