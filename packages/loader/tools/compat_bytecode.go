package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
)

const (
	clientBytecodePath      = "packages/client/scripts/build/hermes.json"
	referenceHermesBytecode = "hermes-bytecode"
)

func readHermesBytecodeVersion(data []byte) (uint32, error) {
	if len(data) < 12 {
		return 0, fmt.Errorf("the file is %d bytes, too short for a Hermes header", len(data))
	}
	if binary.LittleEndian.Uint64(data) != hermesMagic {
		return 0, errors.New("the file does not start with the Hermes bytecode magic")
	}
	return binary.LittleEndian.Uint32(data[8:]), nil
}

func (target *compatTarget) readHermesBundle(name string, data []byte) {
	target.bundle = name
	version, err := readHermesBytecodeVersion(data)
	if err != nil {
		target.problem = err.Error()
		return
	}
	target.Bytecode = version
	if target.hermes, err = parseHermesStrings(data); err != nil {
		target.problem = err.Error()
	}
}

func loadClientBytecodeReference(root string) (*compatReference, error) {
	data, err := os.ReadFile(filepath.Join(root, clientBytecodePath))
	if err != nil {
		return nil, err
	}
	var config struct {
		BytecodeVersions []uint32 `json:"bytecodeVersions"`
	}
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("%s: %w", clientBytecodePath, err)
	}
	if len(config.BytecodeVersions) == 0 {
		return nil, fmt.Errorf("%s lists no bytecode versions", clientBytecodePath)
	}
	terms := make([]string, len(config.BytecodeVersions))
	for index, version := range config.BytecodeVersions {
		terms[index] = strconv.FormatUint(uint64(version), 10)
	}
	line := 1
	if offset := bytes.Index(data, []byte(`"bytecodeVersions"`)); offset >= 0 {
		line += bytes.Count(data[:offset], []byte("\n"))
	}
	return &compatReference{
		Kind:      referenceHermesBytecode,
		Component: "client",
		Name:      "bytecodeVersions",
		Terms:     terms,
		Locations: []compatLocation{{File: clientBytecodePath, Line: line}},
	}, nil
}

func evaluateBytecodeReference(reference *compatReference, target *compatTarget) (string, string) {
	builds := strings.Join(reference.Terms, ", ")
	if target.Bytecode == 0 {
		return compatBroken, "the Hermes header of `" + target.bundle + "` cannot be read (" + target.problem + "), so the scan cannot tell which bytecode version Discord runs"
	}
	version := strconv.FormatUint(uint64(target.Bytecode), 10)
	if target.hermes == nil {
		return compatBroken, "Discord uses Hermes bytecode " + version + ", but the string table of `" + target.bundle + "` cannot be read (" + target.problem + "), so none of the bundle's lookups were checked"
	}
	if !slices.Contains(reference.Terms, version) {
		return compatWarning, "Discord uses Hermes bytecode " + version + "; the loader falls back to `unbound.js` until the client builds " + version + " (it builds " + builds + ")"
	}
	return compatOK, ""
}

func compatBytecodeFindings(results *compatResults, status string) []compatFinding {
	var findings []compatFinding
	for _, finding := range results.Findings {
		if finding.Reference.Kind == referenceHermesBytecode && finding.Status == status {
			findings = append(findings, finding)
		}
	}
	return findings
}

func compatBytecodeSummary(results *compatResults) string {
	var versions []string
	builds := ""
	for _, finding := range compatBytecodeFindings(results, compatOK) {
		builds = strings.Join(finding.Reference.Terms, ", ")
		for _, target := range results.Targets {
			if target.Platform == finding.Platform {
				versions = append(versions, compatPlatformLabels[target.Platform]+" "+strconv.FormatUint(uint64(target.Bytecode), 10))
			}
		}
	}
	if len(versions) == 0 {
		return ""
	}
	return "Hermes bytecode: " + strings.Join(versions, ", ") + ", which the client builds (" + builds + ")."
}
