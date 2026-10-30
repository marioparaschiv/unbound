package workflowtests

import (
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

type declaredSecret struct{}

type workflowCall struct {
	Secrets map[string]declaredSecret `yaml:"secrets"`
}

type secretsWorkflow struct {
	On   map[string]yaml.Node `yaml:"on"`
	Jobs map[string]struct {
		Uses    string    `yaml:"uses"`
		Secrets yaml.Node `yaml:"secrets"`
	} `yaml:"jobs"`
}

var secretReference = regexp.MustCompile(`secrets\.([A-Za-z_][A-Za-z0-9_]*)`)

func readSecretsWorkflow(t *testing.T, name string) (secretsWorkflow, string) {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(workflowsDirectory(t), name))
	if err != nil {
		t.Fatal(err)
	}
	var workflow secretsWorkflow
	if err := yaml.Unmarshal(data, &workflow); err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	return workflow, string(data)
}

func (workflow secretsWorkflow) workflowCall(t *testing.T) (workflowCall, bool) {
	t.Helper()
	node, ok := workflow.On["workflow_call"]
	if !ok {
		return workflowCall{}, false
	}
	var call workflowCall
	if err := node.Decode(&call); err != nil {
		t.Fatal(err)
	}
	return call, true
}

func referencedSecrets(text string) []string {
	var names []string
	for _, match := range secretReference.FindAllStringSubmatch(text, -1) {
		if match[1] != "GITHUB_TOKEN" && !slices.Contains(names, match[1]) {
			names = append(names, match[1])
		}
	}
	return names
}

func TestParsedReusableWorkflowsDeclareEverySecretTheyRead(t *testing.T) {
	reusable := 0
	for _, name := range workflowFiles(t) {
		workflow, text := readSecretsWorkflow(t, name)
		call, ok := workflow.workflowCall(t)
		if !ok {
			continue
		}
		reusable++
		for _, secret := range referencedSecrets(text) {
			if _, ok := call.Secrets[secret]; !ok {
				t.Errorf("%s reads secrets.%s without declaring it under workflow_call", name, secret)
			}
		}
	}
	if reusable < 4 {
		t.Fatalf("found %d reusable workflows, want at least the loader build ones", reusable)
	}
}

func TestParsedCallersPassExactlyTheDeclaredSecrets(t *testing.T) {
	for _, name := range workflowFiles(t) {
		caller, _ := readSecretsWorkflow(t, name)
		for jobName, job := range caller.Jobs {
			if !strings.HasPrefix(job.Uses, "./.github/workflows/") {
				continue
			}
			if job.Secrets.Kind == yaml.ScalarNode && job.Secrets.Value == "inherit" {
				t.Errorf("%s %s inherits every secret; pass the ones %s declares", name, jobName, job.Uses)
				continue
			}
			passed := map[string]string{}
			if err := job.Secrets.Decode(&passed); err != nil && !job.Secrets.IsZero() {
				t.Fatalf("%s %s secrets: %v", name, jobName, err)
			}
			called, _ := readSecretsWorkflow(t, filepath.Base(job.Uses))
			call, ok := called.workflowCall(t)
			if !ok {
				t.Fatalf("%s %s calls %s, which has no workflow_call trigger", name, jobName, job.Uses)
			}
			declared := call.Secrets
			for secret := range passed {
				if _, ok := declared[secret]; !ok {
					t.Errorf("%s %s passes %s, which %s does not declare", name, jobName, secret, job.Uses)
				}
			}
			for secret := range declared {
				if _, ok := passed[secret]; !ok {
					t.Errorf("%s %s does not pass %s, which %s declares", name, jobName, secret, job.Uses)
				}
			}
		}
	}
}
