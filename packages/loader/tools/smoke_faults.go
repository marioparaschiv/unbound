package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type smokeFaultResult struct {
	Name     string `json:"name"`
	Problem  string `json:"problem"`
	Observed string `json:"observed"`
}

const smokeFaultFixture = `function smokeFixture(id, name, bundle, capabilities) {
	var manifest = { id: id, name: name, description: 'A smoke test fault fixture.', version: '1.0.0', main: 'index.js', authors: [{ name: 'astral smoke', id: '0' }] };
	if (capabilities) manifest.capabilities = capabilities;
	return { manifest: manifest, bundle: bundle };
}
function startedOthers(manager, id) {
	return manager.getEntities().filter(function (entity) { return entity.id !== id && entity.started; }).length;
}
function settle(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }`

const smokeThrowExpression = `(async function () {
	` + smokeFaultFixture + `
	var manager = astral.plugins;
	var id = 'smoke.fault.throws';
	var fixture = smokeFixture(id, 'Smoke fault: throws', "({ start() { throw new Error('smoke fault: thrown on start'); }, stop() {} })");
	var before = startedOthers(manager, id);
	await manager.reload(id, fixture.bundle, fixture.manifest);
	await manager.enable(id);
	await settle(300);
	var entity = manager.getEntity(id);
	var error = manager.errors.get(id);
	var problem = '';
	if (!entity || !entity.failed) problem = 'a plugin that throws on start was not marked failed';
	else if (!error || String(error.message || error).indexOf('smoke fault: thrown on start') < 0) problem = 'the start error was not recorded: ' + String(error && error.message || error);
	else if (startedOthers(manager, id) !== before) problem = 'other plugins stopped when one threw on start';
	await manager.delete(id);
	return JSON.stringify({ name: 'throw on start', problem: problem, observed: entity ? 'failed with ' + String(error && error.message || error) : 'not loaded' });
})()`

const smokeFreezeExpression = `(async function () {
	` + smokeFaultFixture + `
	var manager = astral.plugins;
	var id = 'smoke.fault.freezes';
	var fixture = smokeFixture(id, 'Smoke fault: freezes', "({ start() { var until = Date.now() + 8000; while (Date.now() < until) {} }, stop() {} })");
	var before = startedOthers(manager, id);
	await manager.reload(id, fixture.bundle, fixture.manifest);
	await manager.enable(id);
	await settle(2500);
	await manager.stop(id);
	await manager.start(id);
	await settle(2500);
	var entity = manager.getEntity(id);
	var enabled = manager.settings.get('states', {})[id] === true;
	var freezes = manager.freezes ? manager.freezes.get(id) || 0 : 0;
	var problem = '';
	if (freezes < 2) problem = 'the watchdog attributed ' + freezes + ' of 2 freezes to the plugin that froze Discord';
	else if (enabled || (entity && entity.started)) problem = 'a plugin that froze Discord twice was not disabled';
	else if (startedOthers(manager, id) !== before) problem = 'other plugins stopped after one froze Discord';
	await manager.delete(id);
	return JSON.stringify({ name: 'freeze on start', problem: problem, observed: freezes + ' freezes attributed, ' + (enabled ? 'still enabled' : 'disabled') });
})()`

const smokeCrashFixtureID = "smoke.fault.crashes"

const smokeCrashArmExpression = `(async function () {
	` + smokeFaultFixture + `
	var manager = astral.plugins;
	var id = '` + smokeCrashFixtureID + `';
	var capabilities = ['native.ffi.call', 'native.ffi.symbols'];
	var fixture = smokeFixture(id, 'Smoke fault: crashes', "({ start(context) { var ffi = context.native.ffi; ffi.call(ffi.symbol('abort'), { returnType: 'void', args: [] }); }, stop() {} })", capabilities);
	var states = manager.settings.get('states', {});
	states[id] = false;
	manager.settings.set('states', states);
	await manager.reload(id, fixture.bundle, fixture.manifest);
	var consents = manager.settings.get('consents', {});
	consents[id] = capabilities.slice().sort().join(',');
	manager.settings.set('consents', consents);
	states = manager.settings.get('states', {});
	states[id] = true;
	manager.settings.set('states', states);
	await astral.storage.persist();
	setTimeout(function () { manager.start(id); }, 200);
	return 'armed';
})()`

const smokeCrashCheckExpression = `(async function () {
	var manager = astral.plugins;
	var id = '` + smokeCrashFixtureID + `';
	var entity = manager.getEntity(id);
	var enabled = manager.settings.get('states', {})[id] === true;
	var others = manager.getEntities().filter(function (candidate) { return candidate.id !== id && candidate.started; }).length;
	var problem = '';
	if (!entity) problem = 'the plugin that crashed Discord was not loaded again after the relaunch';
	else if (enabled || entity.started) problem = 'the plugin that crashed Discord while starting was not disabled after the relaunch';
	if (entity) await manager.delete(id);
	return JSON.stringify({ name: 'native crash on start', problem: problem, observed: (entity ? (enabled ? 'still enabled' : 'disabled') : 'missing') + ' after the relaunch, ' + others + ' other plugins started' });
})()`

func runSmokeFault(ctx context.Context, options *smokeOptions, expression string, timeout time.Duration) smokeFaultResult {
	value, err := evaluateSmokeExpressionWithin(ctx, options, expression, timeout)
	if err != nil {
		return smokeFaultResult{Problem: "the fault check could not run: " + err.Error()}
	}
	var result smokeFaultResult
	if err := json.Unmarshal([]byte(value), &result); err != nil {
		return smokeFaultResult{Problem: fmt.Sprintf("unreadable fault result %q", value)}
	}
	return result
}

const (
	smokeCrashRelaunches   = 3
	smokeCrashStopWait     = 30 * time.Second
	smokeCrashRelaunchWait = 10 * time.Minute
	smokeCrashStoppedGrace = 5 * time.Second
	smokeCrashSlowLaunch   = 2 * time.Minute
)

func runSmokeFaults(ctx context.Context, target smokeTarget, options *smokeOptions, runtimeStart time.Duration) []smokeFaultResult {
	faults := []smokeFaultResult{
		runSmokeFault(ctx, options, smokeThrowExpression, 30*time.Second),
		runSmokeFault(ctx, options, smokeFreezeExpression, 60*time.Second),
	}
	if runtimeStart > smokeCrashSlowLaunch {
		return append(faults, smokeFaultResult{
			Name:     "native crash on start",
			Observed: fmt.Sprintf("skipped: Discord's runtime took %s to start here, and the check needs up to %d relaunches", roundStartup(runtimeStart), smokeCrashRelaunches),
		})
	}
	return append(faults, runSmokeCrashFault(ctx, target, options))
}

func runSmokeCrashFault(ctx context.Context, target smokeTarget, options *smokeOptions) smokeFaultResult {
	const name = "native crash on start"
	_, _ = evaluateSmokeExpressionWithin(ctx, options, smokeCrashArmExpression, 20*time.Second)
	if !waitUntil(ctx, smokeCrashStopWait, func() bool { return !target.running(ctx) }) {
		return smokeFaultResult{Name: name, Problem: "the fixture that calls abort() while starting did not crash Discord"}
	}
	for launch := 1; launch <= smokeCrashRelaunches; launch++ {
		if err := target.launch(ctx); err != nil {
			return smokeFaultResult{Name: name, Problem: "relaunch Discord: " + err.Error()}
		}
		if !waitForSmokeDebugger(ctx, target, options) {
			continue
		}
		result := runSmokeFault(ctx, options, smokeCrashCheckExpression, 30*time.Second)
		result.Observed = fmt.Sprintf("%s, on launch %d after the crash", result.Observed, launch)
		return result
	}
	return smokeFaultResult{Name: name, Problem: fmt.Sprintf("Discord kept crashing for %d relaunches, so the loader never disabled the plugin that crashed it", smokeCrashRelaunches)}
}

func waitForSmokeDebugger(ctx context.Context, target smokeTarget, options *smokeOptions) bool {
	answered := false
	stoppedSince := time.Time{}
	waitUntil(ctx, smokeCrashRelaunchWait, func() bool {
		if _, err := evaluateSmokeExpression(ctx, options, "1"); err == nil {
			answered = true
			return true
		}
		if target.running(ctx) {
			stoppedSince = time.Time{}
			return false
		}
		if stoppedSince.IsZero() {
			stoppedSince = time.Now()
		}
		return time.Since(stoppedSince) > smokeCrashStoppedGrace
	})
	return answered
}

func waitUntil(ctx context.Context, limit time.Duration, done func() bool) bool {
	deadline := time.Now().Add(limit)
	for time.Now().Before(deadline) && ctx.Err() == nil {
		if done() {
			return true
		}
		time.Sleep(smokePollInterval)
	}
	return false
}

func faultProblems(faults []smokeFaultResult) []string {
	problems := []string{}
	for _, fault := range faults {
		if fault.Problem != "" {
			name := fault.Name
			if name == "" {
				name = "fault check"
			}
			problems = append(problems, name+": "+fault.Problem)
		}
	}
	return problems
}

func renderSmokeFaults(faults []smokeFaultResult) string {
	if len(faults) == 0 {
		return ""
	}
	var report strings.Builder
	report.WriteString("| Fault check | Result |\n| --- | --- |\n")
	for _, fault := range faults {
		result := fault.Observed
		if fault.Problem != "" {
			result = "**" + fault.Problem + "**"
		}
		fmt.Fprintf(&report, "| %s | %s |\n", fault.Name, result)
	}
	report.WriteString("\n")
	return report.String()
}
