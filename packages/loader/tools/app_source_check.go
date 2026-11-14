package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"slices"
)

type appSource struct {
	Apps []appSourceApp `json:"apps"`
}

type appSourceApp struct {
	Name             string             `json:"name"`
	BundleIdentifier string             `json:"bundleIdentifier"`
	AppPermissions   *appSourcePermits  `json:"appPermissions"`
	Versions         []appSourceVersion `json:"versions"`
}

type appSourcePermits struct {
	Entitlements []string          `json:"entitlements"`
	Privacy      map[string]string `json:"privacy"`
}

type appSourceVersion struct {
	Version      string `json:"version"`
	BuildVersion string `json:"buildVersion"`
	DownloadURL  string `json:"downloadURL"`
	Size         int64  `json:"size"`
}

func runAppSourceCheck(args []string) error {
	set := flag.NewFlagSet("app-source-check", flag.ContinueOnError)
	sourcePath := set.String("source", "", "app-repo.json path")
	ipaPath := set.String("ipa", "", "IPA the newest entry of --bundle-id points at")
	bundleID := set.String("bundle-id", "", "bundle identifier of the app --ipa belongs to")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *sourcePath == "" {
		return errors.New("usage: app-source-check --source <app-repo.json> [--ipa <path> --bundle-id <id>]")
	}
	data, err := os.ReadFile(*sourcePath)
	if err != nil {
		return err
	}
	var source appSource
	if err := json.Unmarshal(data, &source); err != nil {
		return fmt.Errorf("could not parse %s: %w", *sourcePath, err)
	}
	problems := appSourceProblems(source)
	if *ipaPath != "" {
		ipaProblems, err := appSourceIPAProblems(source, *ipaPath, *bundleID)
		if err != nil {
			return err
		}
		problems = append(problems, ipaProblems...)
	}
	for _, problem := range problems {
		fmt.Fprintln(os.Stderr, problem)
	}
	if len(problems) > 0 {
		return fmt.Errorf("%d problems in %s", len(problems), *sourcePath)
	}
	return nil
}

func appSourceProblems(source appSource) []string {
	var problems []string
	for _, app := range source.Apps {
		if len(app.Versions) > 0 && app.AppPermissions == nil {
			problems = append(problems, fmt.Sprintf("%s has no appPermissions, so AltStore refuses its IPAs", app.Name))
		}
		seen := map[string]bool{}
		for _, version := range app.Versions {
			if version.Version == "" || version.BuildVersion == "" || version.DownloadURL == "" || version.Size <= 0 {
				problems = append(problems, fmt.Sprintf("%s %s (%s) misses a version, buildVersion, downloadURL or size", app.Name, version.Version, version.DownloadURL))
			}
			key := version.Version + "+" + version.BuildVersion
			if seen[key] {
				problems = append(problems, fmt.Sprintf("%s lists %s build %s twice", app.Name, version.Version, version.BuildVersion))
			}
			seen[key] = true
		}
	}
	return problems
}

func appSourceIPAProblems(source appSource, ipaPath, bundleID string) ([]string, error) {
	index := slices.IndexFunc(source.Apps, func(app appSourceApp) bool { return app.BundleIdentifier == bundleID })
	if index < 0 {
		return []string{fmt.Sprintf("the source lists no app %s", bundleID)}, nil
	}
	app := source.Apps[index]
	if len(app.Versions) == 0 {
		return []string{fmt.Sprintf("%s has no versions", app.Name)}, nil
	}
	metadata, err := readIPAMetadata(ipaPath)
	if err != nil {
		return nil, err
	}
	permissions, err := readIPAPermissions(ipaPath)
	if err != nil {
		return nil, err
	}
	stat, err := os.Stat(ipaPath)
	if err != nil {
		return nil, err
	}
	newest := app.Versions[0]
	var problems []string
	if newest.Version != metadata.Version || newest.BuildVersion != metadata.Build {
		problems = append(problems, fmt.Sprintf("%s lists %s (%s), the IPA is %s (%s)", app.Name, newest.Version, newest.BuildVersion, metadata.Version, metadata.Build))
	}
	if newest.Size != stat.Size() {
		problems = append(problems, fmt.Sprintf("%s lists %d bytes, the IPA has %d", app.Name, newest.Size, stat.Size()))
	}
	problems = append(problems, missingPermissions(app, permissions)...)
	return problems, nil
}

func missingPermissions(app appSourceApp, permissions ipaPermissions) []string {
	var listed appSourcePermits
	if app.AppPermissions != nil {
		listed = *app.AppPermissions
	}
	var problems []string
	for _, entitlement := range permissions.Entitlements {
		if !slices.Contains(listed.Entitlements, entitlement) {
			problems = append(problems, fmt.Sprintf("%s does not list entitlement %s", app.Name, entitlement))
		}
	}
	for key := range permissions.Privacy {
		if _, ok := listed.Privacy[key]; !ok {
			problems = append(problems, fmt.Sprintf("%s does not list privacy permission %s", app.Name, key))
		}
	}
	slices.Sort(problems)
	return problems
}
