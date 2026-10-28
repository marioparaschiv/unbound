package main

import (
	"strings"
	"testing"
)

func TestParseSmokeResourcesReadsTheLoaderCounts(t *testing.T) {
	resources := parseSmokeResources(`{"hooks":12,"surfaces":2,"cachedReturns":0,"leasedHandles":54}`)
	if resources == nil || *resources != (smokeResources{Hooks: 12, Surfaces: 2, LeasedHandles: 54}) {
		t.Fatalf("unexpected resources %+v", resources)
	}
	if parseSmokeResources("null") != nil || parseSmokeResources("not json") != nil {
		t.Fatal("a loader without counts must report none")
	}
}

func TestRenderSmokeResourcesListsEachCount(t *testing.T) {
	report := renderSmokeResources(&smokeResources{Hooks: 12, Surfaces: 2, LeasedHandles: 54})
	if !strings.Contains(report, "| Java handles referenced from JavaScript | 54 |") || !strings.Contains(report, "| Installed hooks | 12 |") {
		t.Fatalf("resource table missing:\n%s", report)
	}
	if renderSmokeResources(nil) != "" {
		t.Fatal("no counts must render nothing")
	}
}

func TestResourceReportWarnsOnlyWhenHandlesGrowPastMain(t *testing.T) {
	baseline := []smokeStartupRecord{}
	for _, handles := range []float64{50, 60, 55} {
		baseline = append(baseline, smokeStartupRecord{Resources: &smokeResources{LeasedHandles: handles}})
	}
	steady := renderResourceReport(smokeStartupRecord{Resources: &smokeResources{LeasedHandles: 140}}, baseline)
	if len(steady.warnings) != 0 || !strings.Contains(steady.markdown, "| Java handles referenced after GC | 140 | 55 |") {
		t.Fatalf("a small rise must only be reported: %+v", steady)
	}
	leaking := renderResourceReport(smokeStartupRecord{Resources: &smokeResources{LeasedHandles: 900}}, baseline)
	if len(leaking.warnings) != 1 {
		t.Fatalf("a leak must warn: %+v", leaking)
	}
	if early := renderResourceReport(smokeStartupRecord{Resources: &smokeResources{LeasedHandles: 900}}, baseline[:2]); early.markdown != "" {
		t.Fatal("too few measured main runs must compare nothing")
	}
}
