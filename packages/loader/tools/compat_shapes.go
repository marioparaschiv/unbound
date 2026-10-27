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
	shapePickAll     = "all"
	javaObjectClass  = "java.lang.Object"
)

type discordShape struct {
	Owner                 string   `json:"owner,omitempty"`
	OwnerShape            string   `json:"ownerShape,omitempty"`
	Extends               string   `json:"extends,omitempty"`
	Implements            string   `json:"implements,omitempty"`
	ParameterOf           string   `json:"parameterOf,omitempty"`
	WithFields            []string `json:"withFields,omitempty"`
	UnlessClass           string   `json:"unlessClass,omitempty"`
	Member                string   `json:"member"`
	Name                  string   `json:"name,omitempty"`
	Static                *bool    `json:"static,omitempty"`
	Type                  string   `json:"type,omitempty"`
	TypeAssignableTo      string   `json:"typeAssignableTo,omitempty"`
	ReturnsAssignableFrom string   `json:"returnsAssignableFrom,omitempty"`
	FirstParameter        string   `json:"firstParameter,omitempty"`
	ParameterCount        *int     `json:"parameterCount,omitempty"`
	Parameters            []string `json:"parameters,omitempty"`
	Count                 *int     `json:"count,omitempty"`
	Pick                  string   `json:"pick"`
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
	if err := validateDiscordShapes(shapes); err != nil {
		return nil, fmt.Errorf("%s: %w", discordShapesPath, err)
	}
	return shapes, nil
}

func validateDiscordShapes(shapes map[string]discordShape) error {
	for name, shape := range shapes {
		if err := shape.validate(); err != nil {
			return fmt.Errorf("shape %q %w", name, err)
		}
		if shape.OwnerShape == "" {
			continue
		}
		owner, ok := shapes[shape.OwnerShape]
		if !ok {
			return fmt.Errorf("shape %q looks in the class of the unknown shape %q", name, shape.OwnerShape)
		}
		if owner.OwnerShape != "" {
			return fmt.Errorf("shape %q looks in the class of %q, which finds its own class through another shape", name, shape.OwnerShape)
		}
	}
	return nil
}

func (shape discordShape) validate() error {
	switch shape.Member {
	case shapeMethod, shapeField, shapeConstructor:
	default:
		return fmt.Errorf("has an unknown member kind %q", shape.Member)
	}
	switch shape.Pick {
	case shapePickOnly, shapePickLongest:
		if shape.Count != nil {
			return errors.New("has a count but does not pick all matches")
		}
	case shapePickAll:
		if shape.Count == nil {
			return errors.New("picks all matches but has no count")
		}
	default:
		return fmt.Errorf("has an unknown pick %q", shape.Pick)
	}
	selectors := shape.Extends != "" || shape.Implements != "" || shape.ParameterOf != "" || len(shape.WithFields) > 0
	switch {
	case shape.OwnerShape != "" && (shape.Owner != "" || selectors):
		return errors.New("names an owner shape and another way to find its class")
	case shape.Owner == "" && shape.OwnerShape == "" && !selectors:
		return errors.New("names no owner, owner shape, superclass, interface or parameter owner")
	case shape.TypeAssignableTo != "" && (shape.Member != shapeField || shape.Type != ""):
		return errors.New("needs a field without an exact type to check what its type is assignable to")
	case shape.ReturnsAssignableFrom != "" && shape.Member != shapeMethod:
		return errors.New("checks a return type but does not describe a method")
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

func (shape discordShape) matchesMember(member dexMember, dex *dexIndex) bool {
	if member.Field != (shape.Member == shapeField) {
		return false
	}
	if shape.Name != "" && member.Name != shape.Name || shape.Static != nil && member.Static != *shape.Static {
		return false
	}
	if member.Field {
		return (shape.Type == "" || member.Type == shape.Type) &&
			(shape.TypeAssignableTo == "" || dex.isAssignable(member.Type, shape.TypeAssignableTo))
	}
	if shape.ReturnsAssignableFrom != "" && (member.Returns == javaObjectClass || !dex.isAssignable(shape.ReturnsAssignableFrom, member.Returns)) {
		return false
	}
	return shape.matchesParameters(member.Parameters)
}

func (shape discordShape) candidates(class *dexClass, dex *dexIndex) []dexMember {
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
		if shape.matchesMember(member, dex) {
			matches = append(matches, member)
		}
	}
	return matches
}

func (shape discordShape) pick(class *dexClass, dex *dexIndex) ([]dexMember, bool) {
	matches := shape.candidates(class, dex)
	if shape.Pick == shapePickAll {
		return matches, len(matches) == *shape.Count
	}
	if shape.Pick == shapePickLongest && len(matches) > 1 {
		longest := 0
		for _, member := range matches {
			longest = max(longest, len(member.Parameters))
		}
		matches = slices.DeleteFunc(matches, func(member dexMember) bool { return len(member.Parameters) < longest })
	}
	return matches, len(matches) == 1
}

func (shape discordShape) selects(class *dexClass, dex *dexIndex) bool {
	if shape.ParameterOf != "" && !takesOnly(dex.Classes[shape.ParameterOf], class.Name) {
		return false
	}
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

func takesOnly(owner *dexClass, parameter string) bool {
	return owner != nil && slices.ContainsFunc(owner.Declared, func(member dexMember) bool {
		return !member.Field && len(member.Parameters) == 1 && member.Parameters[0] == parameter
	})
}

func (shape discordShape) describeSelector() string {
	var parts []string
	if shape.ParameterOf != "" {
		parts = append(parts, "taken alone by a `"+shape.ParameterOf+"` method")
	}
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
	if shape.TypeAssignableTo != "" {
		parts = append(parts, "of a type assignable to `"+shape.TypeAssignableTo+"`")
	}
	if shape.ReturnsAssignableFrom != "" {
		parts = append(parts, "returning `"+shape.ReturnsAssignableFrom+"` or a supertype other than `"+javaObjectClass+"`")
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

func (shape discordShape) describeMembers() string {
	return strings.Replace(shape.describeMember(), shape.Member, shape.Member+"s", 1)
}

func (shape discordShape) describeExpected() string {
	if shape.Pick == shapePickAll {
		return strconv.Itoa(*shape.Count) + " " + shape.describeMembers()
	}
	return "one " + shape.describeMember()
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
	status, reason := evaluateShape(shape, target)
	if status == compatBroken && shape.UnlessClass != "" && target.dex.Classes[shape.UnlessClass] != nil {
		return compatFallback, reason + "; Discord still has `" + shape.UnlessClass + "`, so the loader does not need this shape"
	}
	return status, reason
}

func evaluateShape(shape discordShape, target *compatTarget) (string, string) {
	switch {
	case shape.OwnerShape != "":
		owner, reason := shapeClass(shape.OwnerShape, target)
		if owner == nil {
			return compatBroken, "it looks in the class the shape `" + shape.OwnerShape + "` finds, but " + reason
		}
		return evaluateShapeOwner(shape, owner, target.dex)
	case shape.Owner != "":
		class := target.dex.Classes[shape.Owner]
		if class == nil {
			return compatBroken, "class `" + shape.Owner + "` is not in Discord's dex"
		}
		return evaluateShapeOwner(shape, class, target.dex)
	}
	owners, reason := selectShapeOwners(shape, target.dex)
	if len(owners) == 1 {
		return compatOK, ""
	}
	return compatBroken, reason
}

func evaluateShapeOwner(shape discordShape, class *dexClass, dex *dexIndex) (string, string) {
	matches, unique := shape.pick(class, dex)
	switch {
	case unique:
		return compatOK, ""
	case len(matches) == 0:
		return compatBroken, "`" + class.Name + "` has no " + shape.describeMember()
	case shape.Pick == shapePickAll:
		return compatBroken, "`" + class.Name + "` has " + strconv.Itoa(len(matches)) + " " + shape.describeMembers() + ", " + describeShapeMembers(matches) + ", not " + strconv.Itoa(*shape.Count)
	}
	return compatBroken, "several members of `" + class.Name + "` fit the " + shape.describeMember() + ", " + describeShapeMembers(matches) + ", so the lookup is ambiguous"
}

func selectShapeOwners(shape discordShape, dex *dexIndex) ([]string, string) {
	if shape.ParameterOf != "" && dex.Classes[shape.ParameterOf] == nil {
		return nil, "class `" + shape.ParameterOf + "` is not in Discord's dex"
	}
	var owners []string
	for _, class := range dex.Classes {
		if !shape.selects(class, dex) {
			continue
		}
		if _, unique := shape.pick(class, dex); unique {
			owners = append(owners, class.Name)
		}
	}
	sort.Strings(owners)
	switch len(owners) {
	case 1:
		return owners, ""
	case 0:
		return nil, "no class " + shape.describeSelector() + " has " + shape.describeExpected()
	}
	listed := owners
	if len(listed) > 3 {
		listed = append(slices.Clone(listed[:3]), "…")
	}
	return owners, "several classes " + shape.describeSelector() + " have " + shape.describeExpected() + ", " + describeTerms(listed) + ", so the lookup is ambiguous"
}

func shapeClass(name string, target *compatTarget) (*dexClass, string) {
	shape := target.shapes[name]
	if status, reason := evaluateShape(shape, target); status != compatOK {
		return nil, reason
	}
	if shape.Owner != "" {
		return target.dex.Classes[shape.Owner], ""
	}
	owners, _ := selectShapeOwners(shape, target.dex)
	return target.dex.Classes[owners[0]], ""
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
