package workflowtests

import (
	"regexp"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

// androidArtifactIDs names the artifact behind each ID an Android download takes. Calls in one run share
// artifact names, and a download by name can take another call's build, so Android downloads take the ID.
var androidArtifactIDs = map[string]string{
	"${{ needs.android.outputs.module_artifact_id }}":         "android module",
	"${{ needs.android.outputs.patched_artifact_id }}":        "patched discord",
	"${{ needs.android.outputs.symbols_artifact_id }}":        "android symbols",
	"${{ needs.android.outputs.emulator_artifact_id }}":       "patched discord emulator split",
	"${{ needs.build-module.outputs.module_artifact_id }}":    "android module",
	"${{ needs.patch-discord.outputs.patched_artifact_id }}":  "patched discord",
	"${{ needs.patch-discord.outputs.emulator_artifact_id }}": "patched discord emulator split",
}

// androidChannelSuffix ends the names of beta and alpha Android artifacts: download-artifact keeps one artifact
// per name, even when it downloads by ID, so each channel's build in one run needs its own names.
const androidChannelSuffix = "${{ inputs.discord_channel != 'stable' && format(' {0}', inputs.discord_channel) || '' }}"

// uploadedArtifact names the artifact an upload step makes, as a stable build names it.
func uploadedArtifact(step workflowStep) string {
	return strings.TrimSuffix(step.With["name"], androidChannelSuffix)
}

// downloadedArtifact names the artifact a download step takes, by name or by an Android build's artifact ID.
func downloadedArtifact(step workflowStep) string {
	if name := step.With["name"]; name != "" {
		return name
	}
	if step.With["merge-multiple"] != "true" {
		return ""
	}
	return androidArtifactIDs[step.With["artifact-ids"]]
}

var stepArtifactID = regexp.MustCompile(`^\$\{\{ steps\.([a-z-]+)\.outputs\.artifact-id \}\}$`)
var jobOutput = regexp.MustCompile(`^\$\{\{ jobs\.([a-z-]+)\.outputs\.([a-z_]+) \}\}$`)

func TestParsedAndroidArtifactIDsNameTheirUploads(t *testing.T) {
	var call struct {
		On struct {
			WorkflowCall struct {
				Outputs map[string]struct {
					Value string `yaml:"value"`
				} `yaml:"outputs"`
			} `yaml:"workflow_call"`
		} `yaml:"on"`
	}
	if err := yaml.Unmarshal(mustReadWorkflow(t, "loader-android.yml"), &call); err != nil {
		t.Fatal(err)
	}
	android := loadWorkflow(t, "loader-android.yml")
	for expression, artifact := range androidArtifactIDs {
		parts := strings.Split(strings.Trim(expression, "${} "), ".")
		output := parts[len(parts)-1]
		jobName, jobOutputName := "", output
		if parts[1] == "android" {
			match := jobOutput.FindStringSubmatch(call.On.WorkflowCall.Outputs[output].Value)
			if match == nil {
				t.Fatalf("loader-android.yml must expose %s from a job output", output)
			}
			jobName, jobOutputName = match[1], match[2]
		} else {
			jobName = parts[1]
		}
		match := stepArtifactID.FindStringSubmatch(android.job(t, jobName).Outputs[jobOutputName])
		if match == nil {
			t.Fatalf("%s %s must be an upload step's artifact-id", jobName, jobOutputName)
		}
		var upload workflowStep
		for _, step := range android.job(t, jobName).Steps {
			if step.ID == match[1] {
				upload = step
			}
		}
		if !strings.HasPrefix(upload.Uses, "actions/upload-artifact@") || upload.With["name"] != artifact+androidChannelSuffix {
			t.Fatalf("%s must be the ID of the %q upload named per channel, step %s uploads %q", expression, artifact, match[1], upload.With["name"])
		}
	}
}
