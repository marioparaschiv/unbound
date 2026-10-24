package main

import (
	"errors"
	"regexp"
	"strings"
)

var semanticVersionPattern = regexp.MustCompile(`^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$`)

type semanticVersion struct {
	major      string
	minor      string
	patch      string
	prerelease []string
}

func compareSemanticVersions(left string, right string) (int, error) {
	leftVersion, err := parseSemanticVersion(left)
	if err != nil {
		return 0, err
	}
	rightVersion, err := parseSemanticVersion(right)
	if err != nil {
		return 0, err
	}

	for _, pair := range [][2]string{
		{leftVersion.major, rightVersion.major},
		{leftVersion.minor, rightVersion.minor},
		{leftVersion.patch, rightVersion.patch},
	} {
		if comparison := compareNumericIdentifiers(pair[0], pair[1]); comparison != 0 {
			return comparison, nil
		}
	}

	if len(leftVersion.prerelease) == 0 && len(rightVersion.prerelease) == 0 {
		return 0, nil
	}
	if len(leftVersion.prerelease) == 0 {
		return 1, nil
	}
	if len(rightVersion.prerelease) == 0 {
		return -1, nil
	}

	for index := 0; index < len(leftVersion.prerelease) && index < len(rightVersion.prerelease); index++ {
		leftIdentifier := leftVersion.prerelease[index]
		rightIdentifier := rightVersion.prerelease[index]
		leftNumeric := isNumericIdentifier(leftIdentifier)
		rightNumeric := isNumericIdentifier(rightIdentifier)
		if leftNumeric && rightNumeric {
			if comparison := compareNumericIdentifiers(leftIdentifier, rightIdentifier); comparison != 0 {
				return comparison, nil
			}
			continue
		}
		if leftNumeric {
			return -1, nil
		}
		if rightNumeric {
			return 1, nil
		}
		if comparison := strings.Compare(leftIdentifier, rightIdentifier); comparison != 0 {
			return comparison, nil
		}
	}

	if len(leftVersion.prerelease) < len(rightVersion.prerelease) {
		return -1, nil
	}
	if len(leftVersion.prerelease) > len(rightVersion.prerelease) {
		return 1, nil
	}
	return 0, nil
}

func parseSemanticVersion(value string) (semanticVersion, error) {
	parts := semanticVersionPattern.FindStringSubmatch(value)
	if parts == nil {
		return semanticVersion{}, errors.New("version must follow semantic versioning 2.0.0")
	}
	parsed := semanticVersion{
		major: parts[1],
		minor: parts[2],
		patch: parts[3],
	}
	if parts[4] != "" {
		parsed.prerelease = strings.Split(parts[4], ".")
		for _, identifier := range parsed.prerelease {
			if isNumericIdentifier(identifier) && len(identifier) > 1 && identifier[0] == '0' {
				return semanticVersion{}, errors.New("numeric prerelease identifiers cannot contain leading zeroes")
			}
		}
	}
	return parsed, nil
}

func compareNumericIdentifiers(left string, right string) int {
	if len(left) < len(right) {
		return -1
	}
	if len(left) > len(right) {
		return 1
	}
	return strings.Compare(left, right)
}

func isNumericIdentifier(value string) bool {
	if value == "" {
		return false
	}
	for _, character := range value {
		if character < '0' || character > '9' {
			return false
		}
	}
	return true
}
