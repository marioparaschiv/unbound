package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strconv"
	"strings"
)

const discordShapesPath = "packages/plugins-shared/src/native/android/discord-shapes.json"

const (
	shapeMethod      = "method"
	shapeField       = "field"
	shapeConstructor = "constructor"
	shapePickOnly    = "only"
	shapePickLongest = "most-parameters"
)

type discordShape struct {
	Owner          string   `json:"owner,omitempty"`
	Extends        string   `json:"extends,omitempty"`
	Implements     string   `json:"implements,omitempty"`
	WithFields     []string `json:"withFields,omitempty"`
	Member         string   `json:"member"`
	Name           string   `json:"name,omitempty"`
	Static         *bool    `json:"static,omitempty"`
	Type           string   `json:"type,omitempty"`
	FirstParameter string   `json:"firstParameter,omitempty"`
	ParameterCount *int     `json:"parameterCount,omitempty"`
	Parameters     []string `json:"parameters,omitempty"`
	Pick           string   `json:"pick"`
}

func loadDiscordShapes(root string) (map[string]discordShape, error) {
	data, err := os.ReadFile(filepath.Join(root, discordShapesPath))
	if errors.Is(err, fs.ErrNotExist) {
		return map[string]discordShape{}, nil
	}
	if err != nil {
		return nil, err
	}
	var shapes map[string]discordShape
	if err := json.Unmarshal(data, &shapes); err != nil {
		return nil, fmt.Errorf("%s: %w", discordShapesPath, err)
	}
	for name, shape := range shapes {
		if err := shape.validate(); err != nil {
			return nil, fmt.Errorf("%s: shape %q %w", discordShapesPath, name, err)
		}
	}
	return shapes, nil
}

func (shape discordShape) validate() error {
	switch shape.Member {
	case shapeMethod, shapeField, shapeConstructor:
	default:
		return fmt.Errorf("has an unknown member kind %q", shape.Member)
	}
	switch shape.Pick {
	case shapePickOnly, shapePickLongest:
	default:
		return fmt.Errorf("has an unknown pick %q", shape.Pick)
	}
	if shape.Owner == "" && shape.Extends == "" && shape.Implements == "" {
		return errors.New("names no owner, superclass or interface")
	}
	return nil
}

func (shape discordShape) matchesParameters(parameters []string) bool {
	if shape.FirstParameter != "" && (len(parameters) == 0 || parameters[0] != shape.FirstParameter) {
		return false
	}
	if shape.ParameterCount != nil && len(parameters) != *shape.ParameterCount {
		return false
	}
	return shape.Parameters == nil || slices.Equal(parameters, shape.Parameters)
}

func (shape discordShape) matchesMember(member dexMember) bool {
	if member.Field != (shape.Member == shapeField) {
		return false
	}
	if shape.Name != "" && member.Name != shape.Name || shape.Static != nil && member.Static != *shape.Static {
		return false
	}
	if member.Field {
		return shape.Type == "" || member.Type == shape.Type
	}
	return shape.matchesParameters(member.Parameters)
}

func (shape discordShape) candidates(class *dexClass) []dexMember {
	var matches []dexMember
	if shape.Member == shapeConstructor {
		for _, parameters := range class.Constructors {
			if shape.matchesParameters(parameters) {
				matches = append(matches, dexMember{Name: dexConstructorName, Parameters: parameters})
			}
		}
		return matches
	}
	for _, member := range class.Declared {
		if shape.matchesMember(member) {
			matches = append(matches, member)
		}
	}
	return matches
}

func (shape discordShape) pick(class *dexClass) ([]dexMember, bool) {
	matches := shape.candidates(class)
	if shape.Pick == shapePickLongest && len(matches) > 1 {
		longest := 0
		for _, member := range matches {
			longest = max(longest, len(member.Parameters))
		}
		matches = slices.DeleteFunc(matches, func(member dexMember) bool { return len(member.Parameters) < longest })
	}
	return matches, len(matches) == 1
}

func (shape discordShape) selects(class *dexClass) bool {
	if shape.Extends != "" && class.Super != shape.Extends {
		return false
	}
	if shape.Implements != "" && !slices.Contains(class.Interfaces, shape.Implements) {
		return false
	}
	for _, fieldType := range shape.WithFields {
		if !slices.ContainsFunc(class.Declared, func(member dexMember) bool {
			return member.Field && !member.Static && member.Type == fieldType
		}) {
			return false
		}
	}
	return true
}

func (shape discordShape) describeSelector() string {
	var parts []string
	if shape.Extends != "" {
		parts = append(parts, "extending `"+shape.Extends+"`")
	}
	if shape.Implements != "" {
		parts = append(parts, "implementing `"+shape.Implements+"`")
	}
	if len(shape.WithFields) > 0 {
		parts = append(parts, "with "+describeTerms(shape.WithFields)+" fields")
	}
	return strings.Join(parts, " and ")
}

func (shape discordShape) describeMember() string {
	var parts []string
	if shape.Static != nil && !*shape.Static {
		parts = append(parts, "non-static")
	}
	if shape.Static != nil && *shape.Static {
		parts = append(parts, "static")
	}
	parts = append(parts, shape.Member)
	if shape.Name != "" {
		parts = append(parts, "`"+shape.Name+"`")
	}
	if shape.Type != "" {
		parts = append(parts, "of type `"+shape.Type+"`")
	}
	if shape.FirstParameter != "" {
		parts = append(parts, "taking `"+shape.FirstParameter+"` first")
	}
	if shape.ParameterCount != nil {
		count := "with " + strconv.Itoa(*shape.ParameterCount) + " parameter"
		if *shape.ParameterCount != 1 {
			count += "s"
		}
		parts = append(parts, count)
	}
	if shape.Parameters != nil {
		parts = append(parts, "taking ("+strings.Join(shape.Parameters, ", ")+")")
	}
	return strings.Join(parts, " ")
}

func describeShapeMembers(members []dexMember) string {
	names := make([]string, len(members))
	for index, member := range members {
		names[index] = member.Name
		if !member.Field {
			names[index] += "(" + strings.Join(member.Parameters, ", ") + ")"
		}
	}
	return describeTerms(names)
}

func evaluateShapeReference(reference *compatReference, target *compatTarget) (string, string) {
	shape, ok := target.shapes[reference.Name]
	if !ok {
		return compatBroken, "`" + discordShapesPath + "` has no shape `" + reference.Name + "`"
	}
	member := shape.describeMember()
	if shape.Owner != "" {
		class := target.dex.Classes[shape.Owner]
		if class == nil {
			return compatBroken, "class `" + shape.Owner + "` is not in Discord's dex"
		}
		matches, unique := shape.pick(class)
		switch {
		case unique:
			return compatOK, ""
		case len(matches) == 0:
			return compatBroken, "`" + shape.Owner + "` has no " + member
		}
		return compatBroken, "several members of `" + shape.Owner + "` fit the " + member + ", " + describeShapeMembers(matches) + ", so the lookup is ambiguous"
	}
	var owners []string
	for _, class := range target.dex.Classes {
		if !shape.selects(class) {
			continue
		}
		if _, unique := shape.pick(class); unique {
			owners = append(owners, class.Name)
		}
	}
	sort.Strings(owners)
	switch len(owners) {
	case 1:
		return compatOK, ""
	case 0:
		return compatBroken, "no class " + shape.describeSelector() + " has one " + member
	}
	if len(owners) > 3 {
		owners = append(owners[:3], "…")
	}
	return compatBroken, "several classes " + shape.describeSelector() + " have one " + member + ", " + describeTerms(owners) + ", so the lookup is ambiguous"
}

func evaluateResourceReference(reference *compatReference, target *compatTarget) (string, string) {
	if target.resources == nil {
		return compatUnverified, "the APK has no resource table"
	}
	if target.resources.has(discordPackageName, reference.Class, reference.Name) {
		return compatOK, ""
	}
	return compatBroken, "Discord has no `" + reference.Class + "` resource named `" + reference.Name + "`"
}
