package workflowtests

import (
	"strings"
	"testing"
)

func TestParsedStablePollCrossChecksItunesWithDkrypt(t *testing.T) {
	candidate := loadWorkflow(t, "loader-release-poll.yml").job(t, "stable-candidate")
	resolve := candidate.step(t, "Resolve the latest App Store build")
	if resolve.With["resolve-only"] != "true" || resolve.With["channel"] != "appstore" || resolve.With["output"] != "" {
		t.Fatalf("the stable poll must resolve without downloading, got %+v", resolve.With)
	}
	check := candidate.step(t, "Resolve stable candidate")
	if check.Env["APPSTORE_VERSION"] != "${{ steps.appstore.outputs.version }}" || !strings.Contains(check.Run, `--version "$APPSTORE_VERSION"`) {
		t.Fatalf("the stable candidate must see dkrypt's App Store version, got %+v", check)
	}
}
