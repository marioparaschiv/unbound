//! A subtree laid out and painted at a different rem size, so gpui-component controls inside it
//! (sized in rems) grow and shrink with a scale animation. gpui has no transforms; this is the
//! part of a scale that rems can carry, and callers multiply their own pixel lengths to match.

use gpui::{
	AnyElement, App, Bounds, Element, ElementId, GlobalElementId, InspectorElementId, IntoElement,
	LayoutId, Pixels, Window,
};

pub struct RemScaled {
	child: AnyElement,
	scale: f32,
}

/// Lays out and paints `child` with the window's rem size multiplied by `scale`.
pub fn rem_scaled(child: impl IntoElement, scale: f32) -> RemScaled {
	RemScaled {
		child: child.into_any_element(),
		scale,
	}
}

impl RemScaled {
	fn rem(&self, window: &Window) -> Option<Pixels> {
		(self.scale != 1.).then(|| window.rem_size() * self.scale)
	}
}

impl IntoElement for RemScaled {
	type Element = Self;

	fn into_element(self) -> Self::Element {
		self
	}
}

impl Element for RemScaled {
	type RequestLayoutState = ();
	type PrepaintState = ();

	fn id(&self) -> Option<ElementId> {
		None
	}

	fn source_location(&self) -> Option<&'static std::panic::Location<'static>> {
		None
	}

	fn request_layout(
		&mut self,
		_: Option<&GlobalElementId>,
		_: Option<&InspectorElementId>,
		window: &mut Window,
		cx: &mut App,
	) -> (LayoutId, ()) {
		let rem = self.rem(window);
		let layout = window.with_rem_size(rem, |window| self.child.request_layout(window, cx));
		(layout, ())
	}

	fn prepaint(
		&mut self,
		_: Option<&GlobalElementId>,
		_: Option<&InspectorElementId>,
		_: Bounds<Pixels>,
		_: &mut (),
		window: &mut Window,
		cx: &mut App,
	) {
		let rem = self.rem(window);
		window.with_rem_size(rem, |window| self.child.prepaint(window, cx));
	}

	fn paint(
		&mut self,
		_: Option<&GlobalElementId>,
		_: Option<&InspectorElementId>,
		_: Bounds<Pixels>,
		_: &mut (),
		_: &mut (),
		window: &mut Window,
		cx: &mut App,
	) {
		let rem = self.rem(window);
		window.with_rem_size(rem, |window| self.child.paint(window, cx));
	}
}
