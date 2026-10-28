package main

import (
	"strings"
	"testing"
)

func TestCycleProblemsFlagFailedSlowAndLeakyPlugins(t *testing.T) {
	cycle := &smokeCycle{
		plugins: []smokeCycleResult{
			{ID: "unbound.good", StopMs: 20, Restarted: true},
			{ID: "unbound.thrown", StopMs: 10, Error: "boom", Restarted: true},
			{ID: "unbound.stuck", StopMs: 10, Restarted: false},
			{ID: "unbound.slow", StopMs: 6000, Restarted: true},
			{ID: "unbound.hooked", StopMs: 10, Restarted: true, HooksBefore: 12, HooksAfter: 14},
		},
		before: &smokeResources{Hooks: 12, Surfaces: 1, Handles: 60},
		after:  &smokeResources{Hooks: 14, Surfaces: 2, Handles: 400},
	}
	problems := strings.Join(cycleProblems(cycle), "\n")
	for _, expected := range []string{
		"unbound.thrown failed its stop and start cycle: boom",
		"unbound.stuck did not start again after stopping",
		"unbound.slow took 6000 ms to stop",
		"unbound.hooked left 14 hooks installed after restarting, up from 12",
		"left 400 native handles referenced, up from 60",
	} {
		if !strings.Contains(problems, expected) {
			t.Fatalf("missing %q in:\n%s", expected, problems)
		}
	}
	if strings.Contains(problems, "unbound.good") {
		t.Fatalf("a clean plugin was flagged:\n%s", problems)
	}
}

func TestCycleProblemsAcceptAStableCycle(t *testing.T) {
	cycle := &smokeCycle{
		plugins: []smokeCycleResult{{ID: "unbound.good", StopMs: 20, Restarted: true}},
		before:  &smokeResources{Hooks: 12, Surfaces: 1, Handles: 60},
		after:   &smokeResources{Hooks: 13, Surfaces: 2, Handles: 90},
	}
	if problems := cycleProblems(cycle); len(problems) != 0 {
		t.Fatalf("a stable cycle was flagged: %v", problems)
	}
	if report := renderSmokeCycle(cycle); !strings.Contains(report, "Stopped and restarted 1 plugins") || !strings.Contains(report, "| Native handles | 60 | 90 |") {
		t.Fatalf("cycle report missing:\n%s", report)
	}
}
