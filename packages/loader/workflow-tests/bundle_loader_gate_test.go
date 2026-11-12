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

	bundles := loadWorkflow(t, "loader-publish.yml").job(t, "bundles")
	requireNeeds(t, "bundles", bundles, "stable")
	dispatch := bundles.step(t, "Publish the bundles that need this loader").Run
	if strings.Count(dispatch, "gh workflow run build-bundle.yml") != 2 || !strings.Contains(dispatch, `-f version="$(jq -r '."packages/client"' .release-please-manifest.json)"`) {
		t.Fatalf("a published loader must publish beta and the latest client release, runs %q", dispatch)
	}
}
