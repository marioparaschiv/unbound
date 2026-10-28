package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

type smokeCycleResult struct {
	ID          string  `json:"id"`
	StopMs      float64 `json:"stopMs"`
	Error       string  `json:"error"`
	Restarted   bool    `json:"restarted"`
	HooksBefore float64 `json:"hooksBefore"`
	HooksAfter  float64 `json:"hooksAfter"`
}

type smokeCycle struct {
	plugins []smokeCycleResult
	before  *smokeResources
	after   *smokeResources
	err     string
}

const (
	smokeCycleStopLimitMs    = 5000
	cycleHandleGrowthRatio   = 1.5
	cycleHandleGrowthMinimum = 50
)

const smokeCycleExpression = `(async function () {
	var manager = unbound.plugins;
	var read = unbound.native && unbound.native.getNativeResources;
	var hooks = function () { var counts = read ? read() : null; return counts ? counts.hooks : 0; };
	var settle = function () { return new Promise(function (resolve) { setTimeout(resolve, 300); }); };
	var results = [];
	var running = manager.getEntities().filter(function (entity) { return entity.started; });
	for (var index = 0; index < running.length; index++) {
		var id = running[index].id;
		var before = manager.errors.get(id);
		var hooksBefore = hooks();
		var error = '';
		var started = Date.now();
		try { await manager.stop(id); } catch (failure) { error = String(failure && failure.message ? failure.message : failure); }
		var stopMs = Date.now() - started;
		try { await manager.start(id); } catch (failure) { error = error || String(failure && failure.message ? failure.message : failure); }
		await settle();
		var after = manager.errors.get(id);
		if (!error && after && after !== before) error = String(after && after.message ? after.message : after);
		var entity = manager.getEntity(id);
		results.push({ id: id, stopMs: stopMs, error: error, restarted: Boolean(entity && entity.started), hooksBefore: hooksBefore, hooksAfter: hooks() });
	}
	return JSON.stringify(results);
})()`

func cycleSmokePlugins(ctx context.Context, options *smokeOptions, before *smokeResources) *smokeCycle {
	cycle := &smokeCycle{before: before}
	value, err := evaluateSmokeExpressionWithin(ctx, options, smokeCycleExpression, smokeCycleEvalTimeout)
	if err != nil {
		cycle.err = err.Error()
		return cycle
	}
	if err := json.Unmarshal([]byte(value), &cycle.plugins); err != nil {
		cycle.err = fmt.Sprintf("unreadable cycle results %q: %v", value, err)
		return cycle
	}
	cycle.after = measureSmokeResources(ctx, options)
	return cycle
}

func cycleProblems(cycle *smokeCycle) []string {
	if cycle == nil {
		return nil
	}
	if cycle.err != "" {
		return []string{"plugin stop and start cycle: " + cycle.err}
	}
	problems := []string{}
	for _, plugin := range cycle.plugins {
		switch {
		case plugin.Error != "":
			problems = append(problems, fmt.Sprintf("%s failed its stop and start cycle: %s", plugin.ID, plugin.Error))
		case !plugin.Restarted:
			problems = append(problems, fmt.Sprintf("%s did not start again after stopping", plugin.ID))
		case plugin.StopMs > smokeCycleStopLimitMs:
			problems = append(problems, fmt.Sprintf("%s took %.0f ms to stop, over the %d ms limit", plugin.ID, plugin.StopMs, smokeCycleStopLimitMs))
		case plugin.HooksAfter > plugin.HooksBefore:
			problems = append(problems, fmt.Sprintf("%s left %.0f hooks installed after restarting, up from %.0f", plugin.ID, plugin.HooksAfter, plugin.HooksBefore))
		}
	}
	if cycle.before == nil || cycle.after == nil {
		return problems
	}
	if cycle.after.Handles > cycle.before.Handles*cycleHandleGrowthRatio && cycle.after.Handles-cycle.before.Handles > cycleHandleGrowthMinimum {
		problems = append(problems, fmt.Sprintf("restarting every plugin left %.0f native handles referenced, up from %.0f", cycle.after.Handles, cycle.before.Handles))
	}
	return problems
}

func renderSmokeCycle(cycle *smokeCycle) string {
	if cycle == nil || cycle.err != "" || len(cycle.plugins) == 0 {
		return ""
	}
	slowest := cycle.plugins[0]
	for _, plugin := range cycle.plugins {
		if plugin.StopMs > slowest.StopMs {
			slowest = plugin
		}
	}
	var report strings.Builder
	fmt.Fprintf(&report, "Stopped and restarted %d plugins. Slowest stop: `%s` %.0f ms.\n\n", len(cycle.plugins), slowest.ID, slowest.StopMs)
	if cycle.before != nil && cycle.after != nil {
		fmt.Fprintf(&report, "| After the cycle | Before | After |\n| --- | --- | --- |\n| Native handles | %.0f | %.0f |\n| Hooks | %.0f | %.0f |\n| Surfaces | %.0f | %.0f |\n\n",
			cycle.before.Handles, cycle.after.Handles, cycle.before.Hooks, cycle.after.Hooks, cycle.before.Surfaces, cycle.after.Surfaces)
	}
	return report.String()
}
