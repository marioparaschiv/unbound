package main

import (
	"context"
	"embed"
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

//go:embed smoke_scripts/*.js
var smokeScriptFiles embed.FS

const smokeCrashFixtureID = "smoke.fault.crashes"

func smokeScript(name string) string {
	helpers, err := smokeScriptFiles.ReadFile("smoke_scripts/fault-helpers.js")
	if err != nil {
		panic(err)
	}
	script, err := smokeScriptFiles.ReadFile("smoke_scripts/" + name)
	if err != nil {
		panic(err)
	}
	return strings.Replace(string(script), "__FAULT_HELPERS__", strings.TrimSpace(string(helpers)), 1)
}

var (
	smokeThrowExpression      = smokeScript("throw-on-start.js")
	smokeFreezeExpression     = smokeScript("freeze-on-start.js")
	smokeCrashArmExpression   = smokeScript("arm-crash.js")
	smokeCrashCheckExpression = smokeScript("check-crash.js")
)

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
	if problem := armSmokeCrashFixture(evaluateSmokeExpressionWithin(ctx, options, smokeCrashArmExpression, 20*time.Second)); problem != "" {
		return smokeFaultResult{Name: name, Problem: problem}
	}
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

func armSmokeCrashFixture(value string, err error) string {
	switch {
	case err != nil && strings.HasPrefix(err.Error(), smokeDeviceThrew):
		return "the crash fixture could not be armed: " + err.Error()
	case err == nil && value != "armed":
		return fmt.Sprintf("the crash fixture could not be armed: the device answered %q", value)
	}
	return ""
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
