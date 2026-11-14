package main

import (
	"slices"
	"testing"
)

func TestMachoAppGroups(t *testing.T) {
	binary := extensionBinary(t, true, "group.com.hammerandchisel.discord", "group.com.example.second")

	groups := machoAppGroups([]byte(binary))

	if !slices.Equal(groups, []string{"group.com.hammerandchisel.discord", "group.com.example.second"}) {
		t.Fatalf("got groups %v", groups)
	}
	if groups := machoAppGroups([]byte(extensionBinary(t, false))); groups != nil {
		t.Fatalf("an unsigned binary has no groups, got %v", groups)
	}
	if groups := machoAppGroups([]byte("not a binary")); groups != nil {
		t.Fatalf("got groups %v from garbage", groups)
	}
}
