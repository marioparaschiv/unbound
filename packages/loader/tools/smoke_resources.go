package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"
)

type smokeResources struct {
	Hooks         float64 `json:"hooks"`
	Surfaces      float64 `json:"surfaces"`
	CachedReturns float64 `json:"cachedReturns"`
	Handles       float64 `json:"handles"`
}

const (
	smokeCollectExpression   = `(function () { if (typeof gc === 'function') gc(); return 'collected'; })()`
	smokeResourcesExpression = `(function () {
	if (typeof gc === 'function') gc();
	var read = astral.native && astral.native.getNativeResources;
	return JSON.stringify(read ? read() || null : null);
})()`
	smokeReleaseSettle      = 3 * time.Second
	handleRegressionRatio   = 1.5
	handleRegressionMinimum = 100
)

func measureSmokeResources(ctx context.Context, options *smokeOptions) *smokeResources {
	if _, err := evaluateSmokeExpression(ctx, options, smokeCollectExpression); err != nil {
		return nil
	}
	select {
	case <-ctx.Done():
		return nil
	case <-time.After(smokeReleaseSettle):
	}
	value, err := evaluateSmokeExpression(ctx, options, smokeResourcesExpression)
	if err != nil {
		return nil
	}
	return parseSmokeResources(value)
}

func parseSmokeResources(value string) *smokeResources {
	var resources *smokeResources
	if json.Unmarshal([]byte(value), &resources) != nil {
		return nil
	}
	return resources
}

const (
	smokeExpressionEvalTimeout = 30 * time.Second
	smokeCycleEvalTimeout      = 4 * time.Minute
)

func evaluateSmokeExpression(ctx context.Context, options *smokeOptions, expression string) (string, error) {
	return evaluateSmokeExpressionWithin(ctx, options, expression, smokeExpressionEvalTimeout)
}

func evaluateSmokeExpressionWithin(ctx context.Context, options *smokeOptions, expression string, timeout time.Duration) (string, error) {
	cli := filepath.Join(options.repository, "packages", "cli", "src", "index.ts")
	evalCtx, cancel := context.WithTimeout(ctx, timeout+30*time.Second)
	defer cancel()
	output, err := exec.CommandContext(evalCtx, "bun", cli, "eval", "--json", "--port", strconv.Itoa(options.bridgePort), "--timeout", strconv.FormatInt(timeout.Milliseconds(), 10), expression).Output()
	var result struct {
		OK    bool   `json:"ok"`
		Value string `json:"value"`
		Error string `json:"error"`
	}
	if jsonErr := json.Unmarshal(lastJSONLine(output), &result); jsonErr != nil {
		if err != nil {
			return "", err
		}
		return "", jsonErr
	}
	if !result.OK {
		return "", fmt.Errorf("the device threw: %s", result.Error)
	}
	return result.Value, nil
}

func renderSmokeResources(resources *smokeResources) string {
	if resources == nil {
		return ""
	}
	return fmt.Sprintf("| Native resource after GC | Count |\n| --- | --- |\n| Native handles referenced from JavaScript | %.0f |\n| Installed hooks | %.0f |\n| Mounted surfaces | %.0f |\n| Cached hook return values | %.0f |\n\n",
		resources.Handles, resources.Hooks, resources.Surfaces, resources.CachedReturns)
}

func handlesOf(record smokeStartupRecord) (float64, bool) {
	if record.Resources == nil {
		return 0, false
	}
	return record.Resources.Handles, true
}

func renderResourceReport(current smokeStartupRecord, baseline []smokeStartupRecord) regressionReport {
	measured := []smokeStartupRecord{}
	for _, record := range baseline {
		if record.Resources != nil {
			measured = append(measured, record)
		}
	}
	if current.Resources == nil || len(measured) < regressionMinimumSamples {
		return regressionReport{}
	}
	median := medianOf(measured, handlesOf)
	value := current.Resources.Handles
	markdown := fmt.Sprintf("## Native resources compared with main\n\n| Resource | This run | Median of %d main runs |\n| --- | --- | --- |\n| Native handles referenced after GC | %.0f | %.0f |\n\n", len(measured), value, median)
	if value <= median*handleRegressionRatio || value-median <= handleRegressionMinimum {
		return regressionReport{markdown: markdown}
	}
	line := fmt.Sprintf("%.0f native handles stayed referenced after GC against a median of %.0f", value, median)
	return regressionReport{markdown: markdown + "- " + line + "\n\n", warnings: []regressionWarning{{title: "Native resource regression", message: line}}}
}
