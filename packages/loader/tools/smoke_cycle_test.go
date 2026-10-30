package main

import (
	"strings"
	"testing"
)

func TestCycleProblemsFlagFailedSlowAndLeakyPlugins(t *testing.T) {
	cycle := &smokeCycle{
		plugins: []smokeCycleResult{
			{ID: "astral.good", StopMs: 20, Restarted: true, Updated: true, HooksBefore: 12, HooksStopped: 10, HooksAfter: 12, HooksUpdated: 12},
			{ID: "astral.unhooked", StopMs: 10, Restarted: true, Updated: true, HooksBefore: 12, HooksStopped: 9, HooksAfter: 9},
			{ID: "astral.update-thrown", StopMs: 10, Restarted: true, UpdateError: "bad bundle"},
			{ID: "astral.update-stuck", StopMs: 10, Restarted: true},
			{ID: "astral.update-unhooked", StopMs: 10, Restarted: true, Updated: true, HooksBefore: 12, HooksStopped: 10, HooksAfter: 12, HooksUpdated: 10},
			{ID: "astral.update-leaky", StopMs: 10, Restarted: true, Updated: true, HooksBefore: 12, HooksStopped: 10, HooksAfter: 12, HooksUpdated: 14},
			{ID: "astral.thrown", StopMs: 10, Error: "boom", Restarted: true},
			{ID: "astral.stuck", StopMs: 10, Restarted: false},
			{ID: "astral.slow", StopMs: 6000, Restarted: true},
			{ID: "astral.hooked", StopMs: 10, Restarted: true, HooksBefore: 12, HooksAfter: 14},
		},
		before: &smokeResources{Hooks: 12, Surfaces: 1, Handles: 60},
		after:  &smokeResources{Hooks: 14, Surfaces: 2, Handles: 400},
	}
	problems := strings.Join(cycleProblems(cycle), "\n")
	for _, expected := range []string{
		"astral.thrown failed its stop and start cycle: boom",
		"astral.stuck did not start again after stopping",
		"astral.slow took 6000 ms to stop",
		"astral.hooked left 14 hooks installed after restarting, up from 12",
		"astral.unhooked did not re-apply its 3 hooks after restarting",
		"astral.update-thrown failed its update: bad bundle",
		"astral.update-stuck was not running after its update",
		"astral.update-unhooked did not re-apply its 2 hooks after its update",
		"astral.update-leaky left 14 hooks installed after its update, up from 12",
		"left 400 native handles referenced, up from 60",
	} {
		if !strings.Contains(problems, expected) {
			t.Fatalf("missing %q in:\n%s", expected, problems)
		}
	}
	if strings.Contains(problems, "astral.good") {
		t.Fatalf("a clean plugin was flagged:\n%s", problems)
	}
}

func TestCycleProblemsAcceptAStableCycle(t *testing.T) {
	cycle := &smokeCycle{
		plugins: []smokeCycleResult{{ID: "astral.good", StopMs: 20, Restarted: true, Updated: true}},
		before:  &smokeResources{Hooks: 12, Surfaces: 1, Handles: 60},
		after:   &smokeResources{Hooks: 13, Surfaces: 2, Handles: 90},
	}
	if problems := cycleProblems(cycle); len(problems) != 0 {
		t.Fatalf("a stable cycle was flagged: %v", problems)
	}
	if report := renderSmokeCycle(cycle); !strings.Contains(report, "Stopped, restarted and updated 1 plugins") || !strings.Contains(report, "| Native handles | 60 | 90 |") {
		t.Fatalf("cycle report missing:\n%s", report)
	}
}
