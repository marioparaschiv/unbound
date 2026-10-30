package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type vendoredComponent struct {
	Path    string `json:"path"`
	Name    string `json:"name"`
	Version string `json:"version,omitempty"`
	License string `json:"license"`
	URL     string `json:"url"`
}

type spdxChecksum struct {
	Algorithm     string `json:"algorithm"`
	ChecksumValue string `json:"checksumValue"`
}

type spdxPackage struct {
	SPDXID           string         `json:"SPDXID"`
	Name             string         `json:"name"`
	VersionInfo      string         `json:"versionInfo,omitempty"`
	DownloadLocation string         `json:"downloadLocation"`
	FilesAnalyzed    bool           `json:"filesAnalyzed"`
	LicenseConcluded string         `json:"licenseConcluded"`
	LicenseDeclared  string         `json:"licenseDeclared"`
	CopyrightText    string         `json:"copyrightText"`
	Checksums        []spdxChecksum `json:"checksums,omitempty"`
	Comment          string         `json:"comment,omitempty"`
}

type spdxRelationship struct {
	Element string `json:"spdxElementId"`
	Type    string `json:"relationshipType"`
	Related string `json:"relatedSpdxElement"`
}

type spdxDocument struct {
	SPDXVersion       string `json:"spdxVersion"`
	DataLicense       string `json:"dataLicense"`
	SPDXID            string `json:"SPDXID"`
	Name              string `json:"name"`
	DocumentNamespace string `json:"documentNamespace"`
	CreationInfo      struct {
		Created  string   `json:"created"`
		Creators []string `json:"creators"`
	} `json:"creationInfo"`
	Packages      []spdxPackage      `json:"packages"`
	Relationships []spdxRelationship `json:"relationships"`
}

func readVendoredComponents(root string) ([]vendoredComponent, error) {
	data, err := os.ReadFile(filepath.Join(root, "vendor", "versions.json"))
	if err != nil {
		return nil, err
	}
	var components []vendoredComponent
	if err := json.Unmarshal(data, &components); err != nil {
		return nil, fmt.Errorf("vendor/versions.json: %w", err)
	}
	for _, component := range components {
		if component.Path == "" || component.Name == "" || component.License == "" || component.URL == "" {
			return nil, fmt.Errorf("vendor/versions.json: %q needs a path, name, license and url", component.Name)
		}
	}
	return components, nil
}

func directoryDigest(directory string) (string, error) {
	var lines []string
	err := filepath.WalkDir(directory, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			if entry.Name() == ".git" {
				return filepath.SkipDir
			}
			return nil
		}
		if !entry.Type().IsRegular() {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		relative, err := filepath.Rel(directory, path)
		if err != nil {
			return err
		}
		sum := sha256.Sum256(data)
		lines = append(lines, filepath.ToSlash(relative)+" "+hex.EncodeToString(sum[:]))
		return nil
	})
	if err != nil {
		return "", err
	}
	if len(lines) == 0 {
		return "", fmt.Errorf("%s has no files", directory)
	}
	sort.Strings(lines)
	sum := sha256.Sum256([]byte(strings.Join(lines, "\n")))
	return hex.EncodeToString(sum[:]), nil
}

func submoduleVersion(root, path string) string {
	if _, err := os.Stat(filepath.Join(root, path, ".git")); err != nil {
		return ""
	}
	commit, err := commandOutput(root, "git", "-C", filepath.Join(root, path), "rev-parse", "HEAD")
	if err != nil {
		return ""
	}
	version := strings.TrimSpace(string(commit))
	if tag, err := commandOutput(root, "git", "-C", filepath.Join(root, path), "describe", "--tags", "--exact-match"); err == nil {
		version = strings.TrimSpace(string(tag)) + " (" + version + ")"
	}
	return version
}

func spdxIdentifier(name string) string {
	var builder strings.Builder
	for _, character := range name {
		if (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z') || (character >= '0' && character <= '9') || character == '.' || character == '-' {
			builder.WriteRune(character)
		} else {
			builder.WriteRune('-')
		}
	}
	return "SPDXRef-Package-" + builder.String()
}

func buildLoaderSBOM(root, version, commit string, created time.Time) (spdxDocument, error) {
	root, err := filepath.Abs(root)
	if err != nil {
		return spdxDocument{}, err
	}
	components, err := readVendoredComponents(root)
	if err != nil {
		return spdxDocument{}, err
	}
	document := spdxDocument{
		SPDXVersion:       "SPDX-2.3",
		DataLicense:       "CC0-1.0",
		SPDXID:            "SPDXRef-DOCUMENT",
		Name:              "loader " + version,
		DocumentNamespace: "https://github.com/marioparaschiv/unbound/loader/sbom/" + version + "/" + commit,
	}
	document.CreationInfo.Created = created.UTC().Format(time.RFC3339)
	document.CreationInfo.Creators = []string{"Tool: loader-tools sbom"}
	loader := spdxPackage{
		SPDXID:           "SPDXRef-Package-loader",
		Name:             "loader",
		VersionInfo:      version,
		DownloadLocation: "https://github.com/marioparaschiv/unbound",
		LicenseConcluded: "NOASSERTION",
		LicenseDeclared:  "NOASSERTION",
		CopyrightText:    "NOASSERTION",
		Comment:          "Built from commit " + commit + ".",
	}
	document.Packages = append(document.Packages, loader)
	document.Relationships = append(document.Relationships, spdxRelationship{Element: "SPDXRef-DOCUMENT", Type: "DESCRIBES", Related: loader.SPDXID})
	for _, component := range components {
		digest, err := directoryDigest(filepath.Join(root, component.Path))
		if err != nil {
			return spdxDocument{}, err
		}
		version := component.Version
		if version == "" {
			version = submoduleVersion(root, component.Path)
		}
		pkg := spdxPackage{
			SPDXID:           spdxIdentifier(component.Name),
			Name:             component.Name,
			VersionInfo:      version,
			DownloadLocation: component.URL,
			LicenseConcluded: component.License,
			LicenseDeclared:  component.License,
			CopyrightText:    "NOASSERTION",
			Checksums:        []spdxChecksum{{Algorithm: "SHA256", ChecksumValue: digest}},
			Comment:          "Vendored at " + component.Path + "; the checksum covers every file there.",
		}
		document.Packages = append(document.Packages, pkg)
		document.Relationships = append(document.Relationships, spdxRelationship{Element: loader.SPDXID, Type: "CONTAINS", Related: pkg.SPDXID})
	}
	return document, nil
}

func runSBOM(args []string) error {
	set := flag.NewFlagSet("sbom", flag.ContinueOnError)
	root := set.String("root", ".", "loader root")
	version := set.String("version", "", "loader version the document describes")
	commit := set.String("commit", "", "commit the loader was built from")
	output := set.String("output", "loader-sbom.spdx.json", "where to write the SPDX document")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *version == "" || *commit == "" {
		return errors.New("usage: sbom --version <loader version> --commit <sha> [--output <path>]")
	}
	document, err := buildLoaderSBOM(*root, *version, *commit, time.Now())
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(document, "", "\t")
	if err != nil {
		return err
	}
	return os.WriteFile(*output, append(data, '\n'), 0o644)
}
