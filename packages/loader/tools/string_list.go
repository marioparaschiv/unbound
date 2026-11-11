package main

import "strings"

// stringList is a repeatable string flag: each `--flag value` appends one value.
type stringList []string

func (list *stringList) String() string { return strings.Join(*list, ",") }

func (list *stringList) Set(value string) error {
	*list = append(*list, value)
	return nil
}
