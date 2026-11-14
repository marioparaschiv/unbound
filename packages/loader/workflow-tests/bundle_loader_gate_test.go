package workflowtests

import (
	"slices"
	"strings"
	"testing"
)

func TestParsedBundlesPublishOnlyOnceTheirLoaderIsOut(t *testing.T) {
	build := loadWorkflow(t, "build-bundle.yml").job(t, "build")
	gate := build.step(t, "Check a published loader runs the bundle")
	for _, required := range []string{".minLoaderVersion", "for platform in ios android", "/api/v1/loader/updates", "exit 1"} {
		if !strings.Contains(gate.Run, required) {
			t.Fatalf("the gate must fail unless a published iOS and Android loader meets minLoaderVersion, runs %q", gate.Run)
		}
	}
	index := func(name string) int {
		return slices.IndexFunc(build.Steps, func(step workflowStep) bool { return step.Name == name })
	}
	for _, name := range []string{"Keep source maps", "Publish bundles to builds branch", "Upload bundles to the public bucket", "Record the bundle's minimum loader"} {
		if index(name) < index(gate.Name) {
			t.Fatalf("%q must run after the loader gate", name)
		}
	}

	android := build.step(t, "Check every Android release runs the bundle")
	for _, required := range []string{".minLoaderVersion", "for track in 'Android' 'Android beta' 'Android alpha'", "max_by(.publishedAt)", "exit 1"} {
		if !strings.Contains(android.Run, required) {
			t.Fatalf("the gate must fail unless each Android channel's newest release meets minLoaderVersion, runs %q", android.Run)
		}
	}
	for _, name := range []string{"Keep source maps", "Publish bundles to builds branch", "Upload bundles to the public bucket", "Record the bundle's minimum loader"} {
		if index(name) < index(android.Name) {
			t.Fatalf("%q must run after the Android release gate", name)
		}
	}

	bundles := loadWorkflow(t, "loader-release-poll.yml").job(t, "bundles")
	requireNeeds(t, "bundles", bundles, "stable-release", "testflight-release", "android-beta-release", "android-alpha-release")
	if dispatch := bundles.step(t, "Publish the bundle that waited for these releases").Run; !strings.Contains(dispatch, "gh workflow run build-bundle.yml") {
		t.Fatalf("the releases a loader needs must publish the bundle that waited for them, runs %q", dispatch)
	}
	if _, ok := loadWorkflow(t, "release.yml").Jobs["bundle"]; ok {
		t.Fatal("bundles have one channel, published from main; a client release must not publish another")
	}
}
