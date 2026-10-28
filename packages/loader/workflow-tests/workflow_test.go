package workflowtests

import (
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"runtime"
	"slices"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

type workflowNeeds []string

func (needs *workflowNeeds) UnmarshalYAML(node *yaml.Node) error {
	if node.Kind == yaml.ScalarNode {
		*needs = []string{node.Value}
		return nil
	}
	var list []string
	if err := node.Decode(&list); err != nil {
		return err
	}
	*needs = list
	return nil
}

type workflowStep struct {
	Name string            `yaml:"name"`
	ID   string            `yaml:"id"`
	If   string            `yaml:"if"`
	Uses string            `yaml:"uses"`
	Run  string            `yaml:"run"`
	With map[string]string `yaml:"with"`
	Env  map[string]string `yaml:"env"`

	ContinueOnError string `yaml:"continue-on-error"`
}

type workflowJob struct {
	Name            string            `yaml:"name"`
	ContinueOnError bool              `yaml:"continue-on-error"`
	Needs           workflowNeeds     `yaml:"needs"`
	If              string            `yaml:"if"`
	Uses            string            `yaml:"uses"`
	RunsOn          string            `yaml:"runs-on"`
	TimeoutMinutes  int               `yaml:"timeout-minutes"`
	With            map[string]string `yaml:"with"`
	Outputs         map[string]string `yaml:"outputs"`
	Steps           []workflowStep    `yaml:"steps"`
}

type parsedWorkflow struct {
	Jobs map[string]workflowJob `yaml:"jobs"`
}

func workflowsDirectory(t *testing.T) string {
	t.Helper()
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	return filepath.Join(filepath.Dir(filename), "..", "..", "..", ".github", "workflows")
}

func loadWorkflow(t *testing.T, name string) parsedWorkflow {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(workflowsDirectory(t), name))
	if err != nil {
		t.Fatal(err)
	}
	var workflow parsedWorkflow
	if err := yaml.Unmarshal(data, &workflow); err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	return workflow
}

func (workflow parsedWorkflow) job(t *testing.T, name string) workflowJob {
	t.Helper()
	job, ok := workflow.Jobs[name]
	if !ok {
		t.Fatalf("workflow has no %s job", name)
	}
	return job
}

func (job workflowJob) step(t *testing.T, name string) workflowStep {
	t.Helper()
	for _, step := range job.Steps {
		if step.Name == name {
			return step
		}
	}
	t.Fatalf("job has no %q step", name)
	return workflowStep{}
}

func requireNeeds(t *testing.T, label string, job workflowJob, needs ...string) {
	t.Helper()
	for _, need := range needs {
		if !slices.Contains(job.Needs, need) {
			t.Fatalf("%s must need %s, needs %v", label, need, job.Needs)
		}
	}
}

func TestParsedReleaseBuildsWaitForTheGate(t *testing.T) {
	build := loadWorkflow(t, "loader-build.yml")
	gate := build.job(t, "compat-gate")
	requireNeeds(t, "compat-gate", gate, "resolve-source")
	if gate.If != "inputs.release == true && needs.resolve-source.result == 'success'" {
		t.Fatalf("the gate must run for every successful release resolution, runs if %q", gate.If)
	}
	if !strings.Contains(gate.step(t, "Check the release for breakages").Run, "--fail-on-breakage") {
		t.Fatal("the gate must fail on breakages")
	}
	for _, name := range []string{"ios", "android"} {
		job := build.job(t, name)
		requireNeeds(t, name, job, "resolve-source", "compat-gate")
		if !strings.Contains(job.If, "(needs.compat-gate.result == 'success' || needs.compat-gate.result == 'skipped')") {
			t.Fatalf("the %s build must not run after a failed gate, runs if %q", name, job.If)
		}
	}
	for _, name := range []string{"release", "android-prerelease", "publish-app-repo"} {
		job := build.job(t, name)
		if !slices.Contains(job.Needs, "ios") && !slices.Contains(job.Needs, "android") {
			t.Fatalf("%s must publish only after a gated build, needs %v", name, job.Needs)
		}
	}
}

func TestParsedIOSBuildReusesTheResolvedIPA(t *testing.T) {
	build := loadWorkflow(t, "loader-build.yml")
	keep := build.job(t, "resolve-source").step(t, "Keep the source IPA for the gate and the iOS build")
	if keep.With["name"] != "discord-source-ipa" || keep.If != "steps.select.outputs.platform == 'ios' && steps.decrypt.outcome != 'failure'" {
		t.Fatalf("resolve-source must keep every iOS source IPA it obtained as discord-source-ipa, got %+v", keep)
	}
	decrypt := build.job(t, "resolve-source").step(t, "Decrypt the source IPA")
	if decrypt.ID != "decrypt" || decrypt.ContinueOnError != "true" {
		t.Fatalf("the IPA download must fail softly so the job can decide, got %+v", decrypt)
	}
	require := build.job(t, "resolve-source").step(t, "Require the iOS source for a release")
	if require.If != "steps.decrypt.outcome == 'failure' && (inputs.release == true || inputs.release == 'true')" || !strings.Contains(require.Run, "exit 1") {
		t.Fatalf("a release must fail without the iOS source, got %+v", require)
	}
	ios := build.job(t, "ios")
	if !strings.Contains(ios.If, "needs.resolve-source.outputs.ipa_available != 'false'") {
		t.Fatalf("the iOS build must skip without a source IPA, runs if %q", ios.If)
	}
	if ios.Uses != "./.github/workflows/loader-ios.yml" || ios.With["source_ipa_artifact"] != "${{ needs.resolve-source.result == 'success' && 'discord-source-ipa' || '' }}" {
		t.Fatalf("the iOS build must receive the resolved IPA, got %+v", ios.With)
	}

	source := loadWorkflow(t, "loader-ios.yml").job(t, "resolve-source-ipa")
	download := source.step(t, "Download the resolved source ipa")
	if download.If != "inputs.source_ipa_artifact != ''" || download.With["name"] != "${{ inputs.source_ipa_artifact }}" {
		t.Fatalf("the iOS build must download the resolved IPA when given one, got %+v", download)
	}
	for _, name := range []string{"Decrypt the source ipa", "Download the source ipa"} {
		if step := source.step(t, name); !strings.HasPrefix(step.If, "inputs.source_ipa_artifact == '' && ") {
			t.Fatalf("%q must only run without a resolved IPA, runs if %q", name, step.If)
		}
	}
	for _, output := range []string{"channel", "is_testflight", "version", "cache_hit"} {
		if !strings.HasPrefix(source.Outputs[output], "${{ steps.reuse.outputs."+output+" || ") {
			t.Fatalf("output %s must prefer the reused IPA, got %q", output, source.Outputs[output])
		}
	}
}

func TestParsedTestflightPollResolvesWithoutDownloading(t *testing.T) {
	candidate := loadWorkflow(t, "loader-release-poll.yml").job(t, "testflight-candidate")
	resolve := candidate.step(t, "Resolve the latest TestFlight build")
	if resolve.With["resolve-only"] != "true" || resolve.With["channel"] != "testflight" || resolve.With["output"] != "" {
		t.Fatalf("the TestFlight poll must resolve without downloading, got %+v", resolve.With)
	}
	check := candidate.step(t, "Resolve TestFlight candidate")
	if check.Env["TESTFLIGHT_VERSION"] != "${{ steps.testflight.outputs.version }}" || !strings.Contains(check.Run, `--version "$TESTFLIGHT_VERSION"`) {
		t.Fatalf("the candidate must come from the resolved version, got %+v", check)
	}
}

func TestParsedDkryptStepsShareOnePinnedRelease(t *testing.T) {
	entries, err := os.ReadDir(workflowsDirectory(t))
	if err != nil {
		t.Fatal(err)
	}
	pinned := regexp.MustCompile(`^castdrian/dkrypt@v[0-9]+\.[0-9]+\.[0-9]+$`)
	refs := map[string]bool{}
	for _, entry := range entries {
		if filepath.Ext(entry.Name()) != ".yml" {
			continue
		}
		for jobName, job := range loadWorkflow(t, entry.Name()).Jobs {
			for _, step := range job.Steps {
				if !strings.Contains(step.Uses, "castdrian/dkrypt") {
					continue
				}
				if !pinned.MatchString(step.Uses) {
					t.Fatalf("%s %s %q must use a released version of the dkrypt action, uses %q", entry.Name(), jobName, step.Name, step.Uses)
				}
				if step.With["api-key"] != "${{ secrets.DKRYPT_API_KEY }}" {
					t.Fatalf("%s %s %q must authenticate with the DKRYPT_API_KEY secret", entry.Name(), jobName, step.Name)
				}
				refs[step.Uses] = true
			}
		}
	}
	if len(refs) != 1 {
		t.Fatalf("every dkrypt step must use the same release, found %v", refs)
	}
}

func TestParsedCompatScansDoNotCancelEachOther(t *testing.T) {
	data, err := os.ReadFile(filepath.Join(workflowsDirectory(t), "discord-compat.yml"))
	if err != nil {
		t.Fatal(err)
	}
	var workflow struct {
		Concurrency struct {
			Group string `yaml:"group"`
		} `yaml:"concurrency"`
	}
	if err := yaml.Unmarshal(data, &workflow); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(workflow.Concurrency.Group, "inputs.channel") {
		t.Fatalf("dispatched channels must not share one concurrency group, group is %q", workflow.Concurrency.Group)
	}
}

func TestParsedAndroidBuildRunsTheModuleUnitTests(t *testing.T) {
	module := loadWorkflow(t, "loader-android.yml").job(t, "build-module")
	test := module.step(t, "Test module")
	if !strings.Contains(test.Run, ":module:testDebugUnitTest") {
		t.Fatalf("the module build must run the Kotlin unit tests, runs %q", test.Run)
	}
}

func TestOnlyTheStableScanTracksRemovableLegacyNames(t *testing.T) {
	data, err := os.ReadFile(filepath.Join(workflowsDirectory(t), "discord-compat.yml"))
	if err != nil {
		t.Fatal(err)
	}
	var workflow parsedWorkflow
	if err := yaml.Unmarshal(data, &workflow); err != nil {
		t.Fatal(err)
	}
	var steps []workflowStep
	for _, step := range workflow.Jobs["scan"].Steps {
		if strings.Contains(step.Run, "go run ./tools compat-legacy-issue") {
			steps = append(steps, step)
		}
	}
	if len(steps) != 1 {
		t.Fatalf("the scan job must have one legacy cleanup step, found %d", len(steps))
	}
	step := steps[0]
	if !strings.Contains(step.If, "matrix.channel == 'stable'") || !strings.Contains(step.If, "github.ref_name == github.event.repository.default_branch") {
		t.Fatalf("only the default branch's stable scan may drive the cleanup issue, the step runs if %q", step.If)
	}
	if !strings.Contains(step.Run, "--results compat.json") || !strings.Contains(step.Run, "gh label create discord-compat-cleanup") {
		t.Fatalf("the cleanup step must read the stable scan and label its issue: %s", step.Run)
	}
}

func TestOnlyTheStableScanRemindsToRaiseTheMinimum(t *testing.T) {
	data, err := os.ReadFile(filepath.Join(workflowsDirectory(t), "discord-compat.yml"))
	if err != nil {
		t.Fatal(err)
	}
	var workflow parsedWorkflow
	if err := yaml.Unmarshal(data, &workflow); err != nil {
		t.Fatal(err)
	}
	var steps []workflowStep
	for _, step := range workflow.Jobs["scan"].Steps {
		if strings.Contains(step.Run, "go run ./tools compat-support-issue") {
			steps = append(steps, step)
		}
	}
	if len(steps) != 1 {
		t.Fatalf("the scan job must have one support policy step, found %d", len(steps))
	}
	step := steps[0]
	if !strings.Contains(step.If, "matrix.channel == 'stable'") || !strings.Contains(step.If, "github.ref_name == github.event.repository.default_branch") {
		t.Fatalf("only the default branch's stable scan may drive the support policy issue, the step runs if %q", step.If)
	}
	if !strings.Contains(step.Run, "--results compat.json") || !strings.Contains(step.Run, "gh label create discord-support-policy") {
		t.Fatalf("the support policy step must read the stable scan and label its issue: %s", step.Run)
	}
}

const pullRequestRetention = "${{ github.event_name == 'pull_request' && 14 || 0 }}"

type compositeAction struct {
	Inputs map[string]struct {
		Default string `yaml:"default"`
	} `yaml:"inputs"`
	Runs struct {
		Using string         `yaml:"using"`
		Steps []workflowStep `yaml:"steps"`
	} `yaml:"runs"`
}

func workflowFiles(t *testing.T) []string {
	t.Helper()
	entries, err := os.ReadDir(workflowsDirectory(t))
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, entry := range entries {
		if filepath.Ext(entry.Name()) == ".yml" {
			names = append(names, entry.Name())
		}
	}
	return names
}

func loadCompositeAction(t *testing.T, name string) compositeAction {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(workflowsDirectory(t), "..", "actions", name, "action.yml"))
	if err != nil {
		t.Fatal(err)
	}
	var action compositeAction
	if err := yaml.Unmarshal(data, &action); err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	if action.Runs.Using != "composite" {
		t.Fatalf("%s must be a composite action, runs %q", name, action.Runs.Using)
	}
	return action
}

func (job workflowJob) stepUsing(t *testing.T, prefix string) workflowStep {
	t.Helper()
	for _, step := range job.Steps {
		if strings.HasPrefix(step.Uses, prefix) {
			return step
		}
	}
	t.Fatalf("job has no step using %s", prefix)
	return workflowStep{}
}

func TestParsedEveryJobHasATimeout(t *testing.T) {
	for _, name := range workflowFiles(t) {
		for jobName, job := range loadWorkflow(t, name).Jobs {
			if job.Uses != "" {
				continue
			}
			if job.TimeoutMinutes <= 0 || job.TimeoutMinutes > 60 {
				t.Errorf("%s %s must time out within an hour, has timeout-minutes %d", name, jobName, job.TimeoutMinutes)
			}
		}
	}
}

func TestParsedSharedSetupActionsRunAfterCheckout(t *testing.T) {
	sharedSetups := map[string]int{}
	for _, name := range workflowFiles(t) {
		for jobName, job := range loadWorkflow(t, name).Jobs {
			checkedOut := false
			for _, step := range job.Steps {
				if strings.HasPrefix(step.Uses, "actions/checkout@") {
					checkedOut = true
				}
				if !strings.HasPrefix(step.Uses, "./.github/actions/") {
					continue
				}
				if !checkedOut {
					t.Errorf("%s %s uses %s before checking out the repository", name, jobName, step.Uses)
				}
				sharedSetups[step.Uses]++
			}
		}
	}
	if sharedSetups["./.github/actions/setup-go-tools"] < 14 || sharedSetups["./.github/actions/setup-bun-deps"] < 6 {
		t.Fatalf("the Go and Bun setups must go through the shared actions, found %v", sharedSetups)
	}
}

func TestParsedWorkflowsSetUpGoAndBunOnlyThroughTheSharedActions(t *testing.T) {
	for _, name := range []string{"build-bundle.yml", "ci.yml", "loader-android.yml", "loader-build.yml", "loader-ci.yml", "loader-ios.yml", "loader-release-poll.yml", "plugins-publish.yml", "plugins.yml", "release.yml"} {
		for jobName, job := range loadWorkflow(t, name).Jobs {
			for _, step := range job.Steps {
				if strings.HasPrefix(step.Uses, "actions/setup-go@") || strings.HasPrefix(step.Uses, "oven-sh/setup-bun@") {
					t.Errorf("%s %s sets up %s directly instead of through .github/actions", name, jobName, step.Uses)
				}
			}
		}
	}
	goTools := loadCompositeAction(t, "setup-go-tools")
	if len(goTools.Runs.Steps) != 2 || !strings.HasPrefix(goTools.Runs.Steps[0].Uses, "actions/setup-go@") || goTools.Runs.Steps[0].With["go-version-file"] != "packages/loader/go.mod" || !strings.HasPrefix(goTools.Runs.Steps[1].Uses, "actions/cache@") {
		t.Fatalf("setup-go-tools must install Go and restore its cache, got %+v", goTools.Runs.Steps)
	}
	bun := loadCompositeAction(t, "setup-bun-deps")
	for input, value := range map[string]string{"bun-version": "", "install": "true", "frozen-lockfile": "false"} {
		if declared, ok := bun.Inputs[input]; !ok || declared.Default != value {
			t.Fatalf("setup-bun-deps input %s must default to %q, got %+v", input, value, bun.Inputs)
		}
	}
	if bun.Runs.Steps[1].With["key"] != "bun-${{ runner.os }}-${{ hashFiles('bun.lock') }}" {
		t.Fatalf("setup-bun-deps must key its cache on bun.lock, got %+v", bun.Runs.Steps[1].With)
	}
	for _, name := range []string{"plugins.yml", "plugins-publish.yml"} {
		for _, job := range loadWorkflow(t, name).Jobs {
			if step := job.stepUsing(t, "./.github/actions/setup-bun-deps"); step.With["frozen-lockfile"] != "true" {
				t.Fatalf("%s must keep installing with a frozen lockfile, got %+v", name, step.With)
			}
		}
	}
	syncLock := loadWorkflow(t, "release.yml").job(t, "release").stepUsing(t, "./.github/actions/setup-bun-deps")
	if syncLock.With["install"] != "false" || syncLock.With["bun-version"] != "canary" {
		t.Fatalf("the release PR job installs while it syncs bun.lock, got %+v", syncLock.With)
	}
}

func TestParsedLoaderArtifactsExpireOnlyOnPullRequests(t *testing.T) {
	intermediates := map[string]bool{"discord-source-ipa": true, "source ipa": true, "patched discord emulator split": true}
	diagnostics := map[string]bool{"android smoke test": true, "ios smoke test": true}
	uploaded := map[string]string{}
	for _, name := range []string{"loader-android.yml", "loader-build.yml", "loader-ios.yml"} {
		for jobName, job := range loadWorkflow(t, name).Jobs {
			for _, step := range job.Steps {
				if !strings.HasPrefix(step.Uses, "actions/upload-artifact@") {
					continue
				}
				artifact, retention := step.With["name"], step.With["retention-days"]
				uploaded[artifact] = retention
				if diagnostics[artifact] {
					if retention != "14" || step.If != "always()" {
						t.Errorf("%s %s must keep the %s logs of every run for 14 days, got %q if %q", name, jobName, artifact, retention, step.If)
					}
					continue
				}
				if intermediates[artifact] {
					if retention != "1" {
						t.Errorf("%s %s keeps the decrypted %s for %q days, only its own run needs it", name, jobName, artifact, retention)
					}
					continue
				}
				if retention != pullRequestRetention {
					t.Errorf("%s %s must keep %s for 14 days on pull requests and the default otherwise, got %q", name, jobName, artifact, retention)
				}
			}
		}
	}
	build := loadWorkflow(t, "loader-build.yml")
	for _, jobName := range []string{"release", "android-prerelease"} {
		for _, step := range build.job(t, jobName).Steps {
			if !strings.HasPrefix(step.Uses, "actions/download-artifact@") {
				continue
			}
			retention, ok := uploaded[step.With["name"]]
			if !ok {
				t.Fatalf("%s downloads %q, which no loader job uploads", jobName, step.With["name"])
			}
			if retention != pullRequestRetention {
				t.Fatalf("%s needs %q, which must keep the default retention outside pull requests, got %q", jobName, step.With["name"], retention)
			}
		}
	}
}

func TestParsedReleasesAttachNativeSymbols(t *testing.T) {
	build := loadWorkflow(t, "loader-build.yml")
	release := build.job(t, "release")
	for step, artifact := range map[string]string{"Download iOS tweak symbols": "tweak symbols", "Download Android native symbols": "android symbols"} {
		if download := release.step(t, step); download.With["name"] != artifact || !strings.HasSuffix(download.With["path"], "-symbols") {
			t.Fatalf("the release must download %s into its own directory, got %+v", artifact, download.With)
		}
	}
	if !strings.Contains(release.step(t, "Package native symbols").Run, `zip -qr "../unbound-$platform-symbols.zip" .`) {
		t.Fatal("the release must zip each platform's symbols")
	}
	for step, archives := range map[string][]string{
		"Publish stable release":        {"unbound-ios-symbols.zip", "unbound-android-symbols.zip"},
		"Publish TestFlight prerelease": {"unbound-ios-symbols.zip"},
	} {
		files := release.step(t, step).With["files"]
		for _, archive := range archives {
			if !strings.Contains(files, "release-assets/"+archive) {
				t.Fatalf("%s must attach %s, attaches %q", step, archive, files)
			}
		}
	}
	if strings.Contains(release.step(t, "Publish TestFlight prerelease").With["files"], "android-symbols") {
		t.Fatal("a TestFlight prerelease has no Android build to attach symbols for")
	}
	prerelease := build.job(t, "android-prerelease")
	if prerelease.step(t, "Download Android native symbols").With["name"] != "android symbols" || !strings.Contains(prerelease.step(t, "Publish Android prerelease").With["files"], "release-assets/unbound-android-symbols.zip") {
		t.Fatal("Android prereleases must attach their native symbols")
	}
	module := loadWorkflow(t, "loader-android.yml").job(t, "build-module")
	if upload := module.step(t, "Upload native symbols"); upload.With["name"] != "android symbols" || upload.With["if-no-files-found"] != "error" {
		t.Fatalf("the module build must upload its native symbols, got %+v", upload.With)
	}
}

func TestParsedAndroidSmokeTestGatesTheAndroidBuild(t *testing.T) {
	android := loadWorkflow(t, "loader-android.yml")
	patch := android.job(t, "patch-discord")
	if !strings.Contains(patch.step(t, "Download Discord").Run, "config.x86_64") || !strings.Contains(patch.step(t, "Patch Discord").Run, "mv patched/config.x86_64*.apk emulator/") {
		t.Fatal("the emulator split must be patched with the release package but kept out of it")
	}
	smoke := android.job(t, "smoke")
	requireNeeds(t, "smoke", smoke, "patch-discord")
	if smoke.If != "" || smoke.ContinueOnError {
		t.Fatalf("the Android smoke test must run and fail the build every time, runs if %q", smoke.If)
	}
	runner := smoke.stepUsing(t, "reactivecircus/android-emulator-runner@")
	if !regexp.MustCompile(`@[0-9a-f]{40}$`).MatchString(runner.Uses) {
		t.Fatalf("the emulator runner must be pinned by SHA, uses %q", runner.Uses)
	}
	if runner.With["target"] != "google_apis" || runner.With["arch"] != "x86_64" || !strings.HasPrefix(runner.With["script"], "go run ./tools smoke android --apks smoke/apks") {
		t.Fatalf("the smoke test must run on a rootable x86_64 emulator, got %+v", runner.With)
	}
	if !strings.Contains(smoke.step(t, "Enable KVM").Run, "udevadm trigger --name-match=kvm") {
		t.Fatal("the emulator needs KVM")
	}
	for _, name := range []string{"Download patched Discord", "Download the emulator split"} {
		if !strings.HasPrefix(smoke.step(t, name).Uses, "actions/download-artifact@") {
			t.Fatalf("%q must download the build's own patched Discord", name)
		}
	}
	if smoke.step(t, "Download patched Discord").With["name"] != "patched discord" || smoke.step(t, "Download the emulator split").With["name"] != "patched discord emulator split" {
		t.Fatal("the smoke test must install the patched Discord this run built")
	}
}

func TestParsedIOSSmokeTestGatesTheIOSBuild(t *testing.T) {
	ios := loadWorkflow(t, "loader-ios.yml")
	smoke := ios.job(t, "smoke-simulator")
	requireNeeds(t, "smoke-simulator", smoke, "build-simulator")
	if smoke.If != ios.job(t, "build-simulator").If || smoke.ContinueOnError {
		t.Fatalf("the iOS smoke test must run whenever the simulator is built, runs if %q", smoke.If)
	}
	if smoke.step(t, "Download the simulator build").With["name"] != "ios-simulator" {
		t.Fatal("the smoke test must install this run's simulator build")
	}
	if run := smoke.step(t, "Run the smoke test").Run; !strings.HasPrefix(run, `go run ./tools smoke ios --app "$APP_PATH"`) {
		t.Fatalf("unexpected smoke command %q", run)
	}
}

func TestParsedSmokeTestsGateReleasesAndPullRequests(t *testing.T) {
	build := loadWorkflow(t, "loader-build.yml")
	for name, workflow := range map[string]string{"android": "./.github/workflows/loader-android.yml", "ios": "./.github/workflows/loader-ios.yml"} {
		if build.job(t, name).Uses != workflow {
			t.Fatalf("the %s build must run %s, which holds its smoke test", name, workflow)
		}
	}
	for _, name := range []string{"release", "android-prerelease"} {
		if !strings.Contains(build.job(t, name).If, "needs.android.result == 'success'") {
			t.Fatalf("%s must wait for the Android build and its smoke test", name)
		}
	}
	if !strings.Contains(build.job(t, "release").If, "needs.ios.result == 'success'") {
		t.Fatal("a release must wait for the iOS build and its smoke test")
	}
	data, err := os.ReadFile(filepath.Join(workflowsDirectory(t), "loader-ci.yml"))
	if err != nil {
		t.Fatal(err)
	}
	var workflow struct {
		On struct {
			PullRequest struct {
				Paths []string `yaml:"paths"`
			} `yaml:"pull_request"`
		} `yaml:"on"`
	}
	if err := yaml.Unmarshal(data, &workflow); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"packages/loader/**", "packages/plugins/**", "packages/plugins-shared/**"} {
		if !slices.Contains(workflow.On.PullRequest.Paths, path) {
			t.Fatalf("pull requests touching %s must run the smoke tests, paths are %v", path, workflow.On.PullRequest.Paths)
		}
	}
}

func TestParsedBundlePublishingBuildsOffTmpAndSkipsAnUnconfiguredBucket(t *testing.T) {
	build := loadWorkflow(t, "build-bundle.yml").job(t, "build")
	if got := build.step(t, "Build the client").Env["TMPDIR"]; got != "${{ runner.temp }}" {
		t.Fatalf("hermesc cannot move out of /tmp on hosted runners, so the build must use the runner temp directory, TMPDIR is %q", got)
	}
	if got := build.step(t, "Upload bundles to the public bucket").If; !strings.Contains(got, "vars.S3_PUBLIC_BUCKET != ''") {
		t.Fatalf("the bucket upload must skip when the bucket is not configured, condition is %q", got)
	}
}

func TestParsedPullRequestBuildsUploadOnlyWhenPlanned(t *testing.T) {
	ci := loadWorkflow(t, "loader-ci.yml")
	plan := ci.job(t, "pr-builds")
	planStep := plan.step(t, "Plan the uploads")
	if planStep.Run != "bun scripts/pr-builds-plan.ts plan" {
		t.Fatalf("the plan must come from the tested script, runs %q", planStep.Run)
	}
	for name, value := range map[string]string{
		"IS_FORK":                           "${{ github.event.pull_request.head.repo.full_name != github.repository }}",
		"HAS_S3_ACCESS_KEY_ID":              "${{ secrets.S3_ACCESS_KEY_ID != '' }}",
		"HAS_S3_SECRET_ACCESS_KEY":          "${{ secrets.S3_SECRET_ACCESS_KEY != '' }}",
		"HAS_UNBOUND_PR_BUNDLE_SIGNING_KEY": "${{ secrets.UNBOUND_PR_BUNDLE_SIGNING_KEY != '' }}",
		"CDN_URL":                           "${{ vars.CDN_URL }}",
	} {
		if planStep.Env[name] != value {
			t.Fatalf("the plan must see %s as %q, got %q", name, value, planStep.Env[name])
		}
	}
	for _, name := range []string{"S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "UNBOUND_PR_BUNDLE_SIGNING_KEY"} {
		if _, ok := planStep.Env[name]; ok {
			t.Fatalf("the plan must only learn whether %s is set, never its value", name)
		}
	}

	if build := ci.job(t, "build"); build.With["pr_number"] != "${{ github.event.pull_request.number }}" {
		t.Fatalf("pull request loaders must know their pull request, got %+v", build.With)
	}

	upload := ci.job(t, "upload-pr-builds")
	requireNeeds(t, "upload-pr-builds", upload, "pr-builds", "build")
	if upload.If != "needs.pr-builds.outputs.enabled == 'true'" {
		t.Fatalf("uploads must stay off unless planned, runs if %q", upload.If)
	}
	clientBuild := upload.step(t, "Build the client")
	if clientBuild.Env["TMPDIR"] != "${{ runner.temp }}" || clientBuild.Env["UNBOUND_CHANNEL"] != "pr-${{ github.event.pull_request.number }}" {
		t.Fatalf("the uploaded bundles must be compiled to bytecode on the pull request's own channel, got %+v", clientBuild.Env)
	}
	if _, ok := clientBuild.Env["UNBOUND_BUNDLE_SIGNING_KEY"]; ok {
		t.Fatal("pull request bundles must never be signed with the production key")
	}
	sign := upload.step(t, "Sign the bundles with the pull request key")
	if sign.Env["UNBOUND_PR_BUNDLE_SIGNING_KEY"] != "${{ secrets.UNBOUND_PR_BUNDLE_SIGNING_KEY }}" || sign.Run != `bun run --cwd packages/client sign --dir dist --pr "$PR_NUMBER"` {
		t.Fatalf("pull request bundles must be signed with the pull request key, got %+v", sign)
	}
	if upload.step(t, "Check every bundle is signed").Run != `bun run --cwd packages/client verify-signatures --dir dist --pr "$PR_NUMBER"` {
		t.Fatal("unsigned bundles must never reach the bucket")
	}
	client := upload.step(t, "Upload the client bundles")
	if client.Env["UNBOUND_CHANNEL"] != "pr" || client.Env["UNBOUND_VERSION"] != "${{ github.event.pull_request.number }}" {
		t.Fatalf("the client must upload to unbound/pr/<number>/, got %+v", client.Env)
	}
	downloads := map[string]bool{}
	for _, step := range upload.Steps {
		if strings.HasPrefix(step.Uses, "actions/download-artifact@") {
			downloads[step.With["name"]] = step.With["path"] == "pr-builds"
		}
	}
	for _, artifact := range []string{"rootless package", "ipa", "android module", "patched discord"} {
		if !downloads[artifact] {
			t.Fatalf("the loader upload must include %s, downloads %v", artifact, downloads)
		}
	}
	if upload.step(t, "Upload the loader builds").Run != `bun scripts/pr-builds.ts upload-loader "$PR_NUMBER" pr-builds/*` {
		t.Fatal("the loader builds must upload to loader/pr/<number>/")
	}

	comment := ci.job(t, "comment-pr")
	requireNeeds(t, "comment-pr", comment, "build", "pr-builds", "upload-pr-builds")
	if !strings.HasPrefix(comment.If, "always() && needs.build.result == 'success'") {
		t.Fatalf("the comment must still post when uploads are off, runs if %q", comment.If)
	}
	if comment.step(t, "Describe the S3 builds").Run != "bun scripts/pr-builds-plan.ts comment" || !strings.Contains(comment.step(t, "Comment on current PR").With["message"], "${{ steps.s3.outputs.section }}") {
		t.Fatal("the comment must carry the S3 links or why there are none")
	}
}

func TestParsedLoaderBuildsDeriveThePullRequestBundleURL(t *testing.T) {
	for name, job := range map[string]workflowJob{
		"loader-android.yml build-module": loadWorkflow(t, "loader-android.yml").job(t, "build-module"),
		"loader-ios.yml build-tweak":      loadWorkflow(t, "loader-ios.yml").job(t, "build-tweak"),
	} {
		derive := job.step(t, "Derive the pull request bundle URL")
		if derive.Env["PR_NUMBER"] != "${{ inputs.pr_number || '' }}" || derive.Env["CDN_URL"] != "${{ vars.CDN_URL }}" {
			t.Fatalf("%s must derive the bundle URL from the pull request number it already gets, got %+v", name, derive.Env)
		}
		if !strings.Contains(derive.Run, `if [ -n "$PR_NUMBER" ] && [ -n "$CDN_URL" ]; then`) || !strings.Contains(derive.Run, `UNBOUND_BUNDLE_URL=${CDN_URL%/}/unbound/pr/$PR_NUMBER/`) {
			t.Fatalf("%s must only set a bundle URL for pull request builds, runs %q", name, derive.Run)
		}
	}
	for jobName, job := range loadWorkflow(t, "loader-release-poll.yml").Jobs {
		if _, ok := job.With["pr_number"]; ok {
			t.Fatalf("loader-release-poll.yml %s must keep the release bundle URL", jobName)
		}
	}
}

func TestParsedPullRequestBuildsAreDeletedOnClose(t *testing.T) {
	data, err := os.ReadFile(filepath.Join(workflowsDirectory(t), "pr-builds-cleanup.yml"))
	if err != nil {
		t.Fatal(err)
	}
	var workflow struct {
		On struct {
			PullRequestTarget struct {
				Types []string `yaml:"types"`
			} `yaml:"pull_request_target"`
		} `yaml:"on"`
	}
	if err := yaml.Unmarshal(data, &workflow); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(workflow.On.PullRequestTarget.Types, []string{"closed"}) {
		t.Fatalf("cleanup must run with the bucket secrets when any pull request closes, forks included, runs on %v", workflow.On.PullRequestTarget.Types)
	}
	job := loadWorkflow(t, "pr-builds-cleanup.yml").job(t, "delete")
	if checkout := job.stepUsing(t, "actions/checkout@"); checkout.With["ref"] != "${{ github.event.repository.default_branch }}" {
		t.Fatalf("cleanup must run the default branch's scripts, never the pull request's, checks out %+v", checkout.With)
	}
	config := job.step(t, "Check the bucket configuration")
	if config.Run != "bun scripts/pr-builds-plan.ts cleanup" {
		t.Fatalf("the cleanup must decide through the tested script, runs %q", config.Run)
	}
	remove := job.step(t, "Delete the client and loader builds")
	if remove.If != "steps.config.outputs.enabled == 'true'" || !strings.HasPrefix(remove.Run, `bun scripts/pr-builds.ts delete "$PR_NUMBER"`) {
		t.Fatalf("the cleanup must stay inert without credentials, got %+v", remove)
	}
}

func TestParsedForkBuildsArePublishedByATrustedRun(t *testing.T) {
	ci := loadWorkflow(t, "loader-ci.yml")
	stage := ci.job(t, "stage-fork-pr-builds")
	requireNeeds(t, "stage-fork-pr-builds", stage, "pr-builds", "build")
	if stage.If != "needs.pr-builds.outputs.stage == 'true'" {
		t.Fatalf("only planned fork builds are staged, runs if %q", stage.If)
	}
	if _, signed := stage.step(t, "Build the client").Env["UNBOUND_BUNDLE_SIGNING_KEY"]; signed {
		t.Fatal("the untrusted fork build must stay secret-free")
	}
	staged := map[string]bool{}
	for _, step := range stage.Steps {
		if strings.HasPrefix(step.Uses, "actions/upload-artifact@") {
			staged[step.With["name"]] = true
		}
	}
	if !staged["pr client bundle"] || !staged["pr number"] {
		t.Fatalf("the fork build must stage its client and its pull request number, stages %v", staged)
	}

	data, err := os.ReadFile(filepath.Join(workflowsDirectory(t), "pr-builds-publish.yml"))
	if err != nil {
		t.Fatal(err)
	}
	var trigger struct {
		On struct {
			WorkflowRun struct {
				Workflows []string `yaml:"workflows"`
				Types     []string `yaml:"types"`
			} `yaml:"workflow_run"`
		} `yaml:"on"`
	}
	if err := yaml.Unmarshal(data, &trigger); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(trigger.On.WorkflowRun.Workflows, []string{"Loader Pull Request Build"}) || !reflect.DeepEqual(trigger.On.WorkflowRun.Types, []string{"completed"}) {
		t.Fatalf("fork builds must be published after the loader build completes, triggers %+v", trigger.On.WorkflowRun)
	}
	publish := loadWorkflow(t, "pr-builds-publish.yml").job(t, "publish")
	for _, condition := range []string{"github.event.workflow_run.event == 'pull_request'", "github.event.workflow_run.conclusion == 'success'", "github.event.workflow_run.head_repository.full_name != github.repository"} {
		if !strings.Contains(publish.If, condition) {
			t.Fatalf("the publisher must only handle successful fork builds, runs if %q", publish.If)
		}
	}
	if checkout := publish.stepUsing(t, "actions/checkout@"); checkout.With["ref"] != "${{ github.event.repository.default_branch }}" || checkout.With["persist-credentials"] != "false" {
		t.Fatalf("the publisher must run only the default branch's scripts, checks out %+v", checkout.With)
	}
	confirm := publish.step(t, "Confirm the pull request")
	if confirm.Run != "bun scripts/pr-builds-fork.ts" || confirm.Env["HEAD_SHA"] != "${{ github.event.workflow_run.head_sha }}" || confirm.Env["HEAD_REPOSITORY"] != "${{ github.event.workflow_run.head_repository.full_name }}" {
		t.Fatalf("the claimed pull request must be checked against the run's head, got %+v", confirm)
	}
	plan := publish.step(t, "Plan the uploads")
	if plan.Env["PR_NUMBER"] != "${{ steps.pull-request.outputs.number }}" || plan.Env["HAS_UNBOUND_PR_BUNDLE_SIGNING_KEY"] != "${{ secrets.UNBOUND_PR_BUNDLE_SIGNING_KEY != '' }}" {
		t.Fatalf("the publisher must plan with the confirmed number and the pull request key, got %+v", plan.Env)
	}
	for _, step := range publish.Steps {
		if strings.HasPrefix(step.Uses, "actions/download-artifact@") && step.With["run-id"] != "${{ github.event.workflow_run.id }}" {
			t.Fatalf("%q must download from the fork's run", step.Name)
		}
		if strings.Contains(step.Run, "dist/") {
			t.Fatalf("%q must not run anything from the fork's build", step.Name)
		}
	}
	sign := publish.step(t, "Sign the bundles with the pull request key")
	if sign.Env["UNBOUND_PR_BUNDLE_SIGNING_KEY"] != "${{ secrets.UNBOUND_PR_BUNDLE_SIGNING_KEY }}" || !strings.Contains(sign.Run, `bun run --cwd packages/client sign --dir dist --pr "$PR_NUMBER"`) || !strings.Contains(sign.Run, `verify-signatures --dir dist --pr "$PR_NUMBER"`) {
		t.Fatalf("fork bundles must be signed with the pull request key, got %+v", sign)
	}
	if _, ok := sign.Env["UNBOUND_BUNDLE_SIGNING_KEY"]; ok {
		t.Fatal("fork bundles must never be signed with the production key")
	}
	if check := publish.step(t, "Check the fork's manifest"); check.Run != "bun scripts/pr-builds-fork.ts check-manifest" {
		t.Fatalf("the fork's manifest must declare its own channel, runs %q", check.Run)
	}
	if publish.step(t, "Comment on the pull request").With["pr-number"] != "${{ steps.pull-request.outputs.number }}" {
		t.Fatal("the publisher must comment on the confirmed pull request")
	}
}

func TestParsedManualBuildIsNotARelease(t *testing.T) {
	data, err := os.ReadFile(filepath.Join(workflowsDirectory(t), "loader-build.yml"))
	if err != nil {
		t.Fatal(err)
	}
	var workflow struct {
		On struct {
			WorkflowDispatch struct {
				Inputs map[string]struct {
					Default any `yaml:"default"`
				} `yaml:"inputs"`
			} `yaml:"workflow_dispatch"`
		} `yaml:"on"`
	}
	if err := yaml.Unmarshal(data, &workflow); err != nil {
		t.Fatal(err)
	}
	if release, ok := workflow.On.WorkflowDispatch.Inputs["release"]; !ok || release.Default != false {
		t.Fatalf("a manual loader build must not default to a release, release input %+v", release)
	}
}
