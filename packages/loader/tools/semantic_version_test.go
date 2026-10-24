package main

import "testing"

func TestCompareSemanticVersions(t *testing.T) {
	for _, test := range []struct {
		left       string
		right      string
		comparison int
		wantError  bool
	}{
		{left: "1.0.0", right: "1.0.0", comparison: 0},
		{left: "1.0.1", right: "1.0.0", comparison: 1},
		{left: "2.0.0", right: "10.0.0", comparison: -1},
		{left: "1.0.0-alpha", right: "1.0.0", comparison: -1},
		{left: "1.0.0", right: "1.0.0-rc.1", comparison: 1},
		{left: "1.0.0-rc.2", right: "1.0.0-rc.10", comparison: -1},
		{left: "1.0.0-1", right: "1.0.0-alpha", comparison: -1},
		{left: "1.0.0+one", right: "1.0.0+two", comparison: 0},
		{left: "01.0.0", right: "1.0.0", wantError: true},
		{left: "1.0.0-01", right: "1.0.0", wantError: true},
		{left: "1.0", right: "1.0.0", wantError: true},
	} {
		comparison, err := compareSemanticVersions(test.left, test.right)
		if (err != nil) != test.wantError {
			t.Fatalf("compareSemanticVersions(%q, %q) error = %v", test.left, test.right, err)
		}
		if err == nil && comparison != test.comparison {
			t.Fatalf("compareSemanticVersions(%q, %q) = %d, want %d", test.left, test.right, comparison, test.comparison)
		}
	}
}
