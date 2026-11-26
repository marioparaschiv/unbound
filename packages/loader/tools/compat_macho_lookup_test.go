package main

import "testing"

func TestObjCLookupFollowsAnExternalSuperclassAnotherImageDefines(t *testing.T) {
	index := newObjCIndex()
	index.Classes["DCDAvatarView"] = &objcClass{Name: "DCDAvatarView", Super: "SDAnimatedImageView", SuperExternal: true, Methods: map[string]bool{"clear": true}}
	index.Classes["SDAnimatedImageView"] = &objcClass{Name: "SDAnimatedImageView", Super: "UIImageView", SuperExternal: true, Methods: map[string]bool{"startAnimating": true}}

	if result, owner := index.lookupMethod("DCDAvatarView", "startAnimating"); result != objcFound || owner != "SDAnimatedImageView" {
		t.Fatalf("startAnimating resolved to %v on %q", result, owner)
	}

	if result, owner := index.lookupMethod("DCDAvatarView", "layoutSubviews"); result != objcInheritedExternally || owner != "UIImageView" {
		t.Fatalf("layoutSubviews resolved to %v on %q", result, owner)
	}
}
