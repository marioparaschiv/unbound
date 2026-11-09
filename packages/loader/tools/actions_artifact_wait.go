package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"
)

type actionsJob struct {
	Name       string `json:"name"`
	Status     string `json:"status"`
	Conclusion string `json:"conclusion"`
}

// producerOutcome finds the job that uploads an artifact, matched by its id or the "caller / id" name a reusable
// workflow gives it. It returns the job's conclusion once it finished, or "" while it runs or before it starts.
func producerOutcome(jobs []actionsJob, job string) string {
	for _, candidate := range jobs {
		if candidate.Name != job && !strings.HasSuffix(candidate.Name, " / "+job) {
			continue
		}
		if candidate.Status != "completed" {
			return ""
		}
		return candidate.Conclusion
	}
	return ""
}

// runWaitArtifact lets a job start before the job that builds its input, and fails as soon as that job fails.
func runWaitArtifact(args []string) error {
	set := flag.NewFlagSet("wait-artifact", flag.ContinueOnError)
	repository := set.String("repo", os.Getenv("GITHUB_REPOSITORY"), "owner/name of the run")
	run := set.String("run", os.Getenv("GITHUB_RUN_ID"), "workflow run id")
	attempt := set.String("attempt", os.Getenv("GITHUB_RUN_ATTEMPT"), "workflow run attempt")
	name := set.String("name", "", "artifact to wait for")
	job := set.String("job", "", "id of the job that uploads it")
	timeout := set.Duration("timeout", 40*time.Minute, "fail after waiting this long")
	interval := set.Duration("interval", 10*time.Second, "time between checks")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *repository == "" || *run == "" || *attempt == "" || *name == "" || *job == "" {
		return errors.New("usage: wait-artifact --name <artifact> --job <job id> [--repo <owner/name>] [--run <id>] [--attempt <n>]")
	}
	artifactsPath := fmt.Sprintf("repos/%s/actions/runs/%s/artifacts?name=%s", *repository, *run, url.QueryEscape(*name))
	jobsPath := fmt.Sprintf("repos/%s/actions/runs/%s/attempts/%s/jobs?per_page=100", *repository, *run, *attempt)
	started := time.Now()
	producerSucceeded := false
	for {
		if found, err := artifactUploaded(artifactsPath); err != nil {
			fmt.Printf("Failed to list the artifacts of run %s: %v\n", *run, err)
		} else if found {
			fmt.Printf("%s was uploaded after %s.\n", *name, time.Since(started).Round(time.Second))
			return nil
		}
		// A job that succeeded uploaded before it finished, so one more check settles a listing that lagged.
		if producerSucceeded {
			return fmt.Errorf("%s succeeded without uploading %s", *job, *name)
		}
		jobs, err := listActionsPages[actionsJob](jobsPath, "jobs")
		if err != nil {
			fmt.Printf("Failed to list the jobs of run %s: %v\n", *run, err)
		}
		switch outcome := producerOutcome(jobs, *job); outcome {
		case "":
		case "success":
			producerSucceeded = true
		default:
			return fmt.Errorf("%s finished %s, so %s will not be uploaded", *job, outcome, *name)
		}
		if time.Since(started) > *timeout {
			return fmt.Errorf("%s was not uploaded within %s", *name, *timeout)
		}
		time.Sleep(*interval)
	}
}

func artifactUploaded(path string) (bool, error) {
	output, err := ghAPI(nil, path)
	if err != nil {
		return false, err
	}
	var listing struct {
		TotalCount int `json:"total_count"`
	}
	if err := json.Unmarshal(output, &listing); err != nil {
		return false, err
	}
	return listing.TotalCount > 0, nil
}
