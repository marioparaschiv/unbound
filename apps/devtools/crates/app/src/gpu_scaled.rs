//! A subtree whose text and icons are drawn scaled about its centre by the GPU, like CSS's
//! `transform: scale`. Laid out once at full size, so text never re-lays out or shifts pixels
//! mid-animation. Only glyphs and svgs scale (gpui-fast's sprite transformation); backgrounds,
//! layout and hit testing stay at full size.

use gpui::{
	AnyElement, App, Bounds, Element, ElementId, GlobalElementId, InspectorElementId, IntoElement,
	LayoutId, Pixels, TransformationMatrix, Window, size,
};

pub struct GpuScaled {
	child: AnyElement,
	scale: f32,
}

/// Draws `child`'s glyphs and svgs at `scale` about its centre.
pub fn gpu_scaled(child: impl IntoElement, scale: f32) -> GpuScaled {
	GpuScaled {
		child: child.into_any_element(),
		scale,
	}
}

impl IntoElement for GpuScaled {
	type Element = Self;

	fn into_element(self) -> Self::Element {
		self
	}
}

impl Element for GpuScaled {
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
		(self.child.request_layout(window, cx), ())
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
		self.child.prepaint(window, cx);
	}

	fn paint(
		&mut self,
		_: Option<&GlobalElementId>,
		_: Option<&InspectorElementId>,
		bounds: Bounds<Pixels>,
		_: &mut (),
		_: &mut (),
		window: &mut Window,
		cx: &mut App,
	) {
		if self.scale == 1. {
			self.child.paint(window, cx);
			return;
		}
		// Sprites are in device pixels; read bottom up: centre on the origin, scale, move back.
		let (center, scale_factor) = (bounds.center(), window.scale_factor());
		let matrix = TransformationMatrix::unit()
			.translate(center.scale(scale_factor))
			.scale(size(self.scale, self.scale))
			.translate(center.scale(-scale_factor));
		window.with_sprite_transformation(matrix, |window| self.child.paint(window, cx));
	}
}
