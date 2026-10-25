package main

import (
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
)

const (
	plistDictKind   = "dict"
	plistArrayKind  = "array"
	plistStringKind = "string"
	plistTrueKind   = "true"
	plistFalseKind  = "false"
	plistHeader     = `<?xml version="1.0" encoding="UTF-8"?>` + "\n" + `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">` + "\n"
	binaryPlists    = "bplist"
)

type plistNode struct {
	kind   string
	text   string
	keys   []string
	values []*plistNode
}

func plistText(value string) *plistNode {
	return &plistNode{kind: plistStringKind, text: value}
}

func plistBool(value bool) *plistNode {
	if value {
		return &plistNode{kind: plistTrueKind}
	}
	return &plistNode{kind: plistFalseKind}
}

func plistStrings(values ...string) *plistNode {
	array := &plistNode{kind: plistArrayKind}
	for _, value := range values {
		array.values = append(array.values, plistText(value))
	}
	return array
}

func newPlistDict() *plistNode {
	return &plistNode{kind: plistDictKind}
}

func (node *plistNode) get(key string) *plistNode {
	if node == nil || node.kind != plistDictKind {
		return nil
	}
	for index, candidate := range node.keys {
		if candidate == key {
			return node.values[index]
		}
	}
	return nil
}

func (node *plistNode) set(key string, value *plistNode) {
	for index, candidate := range node.keys {
		if candidate == key {
			node.values[index] = value
			return
		}
	}
	node.keys = append(node.keys, key)
	node.values = append(node.values, value)
}

func (node *plistNode) remove(key string) {
	for index, candidate := range node.keys {
		if candidate == key {
			node.keys = append(node.keys[:index], node.keys[index+1:]...)
			node.values = append(node.values[:index], node.values[index+1:]...)
			return
		}
	}
}

func (node *plistNode) dict(key string) *plistNode {
	if existing := node.get(key); existing != nil && existing.kind == plistDictKind {
		return existing
	}
	created := newPlistDict()
	node.set(key, created)
	return created
}

func readPlist(data []byte) (*plistNode, error) {
	if bytes.HasPrefix(data, []byte(binaryPlists)) {
		converted, err := convertBinaryPlist(data)
		if err != nil {
			return nil, err
		}
		data = converted
	}
	decoder := xml.NewDecoder(bytes.NewReader(data))
	for {
		token, err := decoder.Token()
		if err != nil {
			return nil, fmt.Errorf("could not parse plist: %w", err)
		}
		start, ok := token.(xml.StartElement)
		if !ok || start.Name.Local == "plist" {
			continue
		}
		return decodePlistValue(decoder, start)
	}
}

func convertBinaryPlist(data []byte) ([]byte, error) {
	file, err := os.CreateTemp("", "loader-plist-*.plist")
	if err != nil {
		return nil, err
	}
	defer os.Remove(file.Name())
	if _, err := file.Write(data); err != nil {
		file.Close()
		return nil, err
	}
	if err := file.Close(); err != nil {
		return nil, err
	}
	output, err := exec.Command("plutil", "-convert", "xml1", "-o", "-", file.Name()).Output()
	if err != nil {
		return nil, fmt.Errorf("could not convert binary plist (plutil is required): %w", err)
	}
	return output, nil
}

func decodePlistValue(decoder *xml.Decoder, start xml.StartElement) (*plistNode, error) {
	node := &plistNode{kind: start.Name.Local}
	switch node.kind {
	case plistDictKind:
		return node, decodePlistDict(decoder, node)
	case plistArrayKind:
		return node, decodePlistArray(decoder, node)
	case plistTrueKind, plistFalseKind:
		return node, decoder.Skip()
	case plistStringKind, "integer", "real", "date", "data":
		if err := decoder.DecodeElement(&node.text, &start); err != nil {
			return nil, fmt.Errorf("could not parse plist %s: %w", node.kind, err)
		}
		return node, nil
	default:
		return nil, fmt.Errorf("unsupported plist element %q", node.kind)
	}
}

func decodePlistDict(decoder *xml.Decoder, node *plistNode) error {
	for {
		token, err := decoder.Token()
		if err != nil {
			return fmt.Errorf("could not parse plist dict: %w", err)
		}
		switch element := token.(type) {
		case xml.EndElement:
			if len(node.keys) != len(node.values) {
				return errors.New("plist dict has a key without a value")
			}
			return nil
		case xml.StartElement:
			if element.Name.Local == "key" {
				var key string
				if err := decoder.DecodeElement(&key, &element); err != nil {
					return fmt.Errorf("could not parse plist key: %w", err)
				}
				if len(node.keys) != len(node.values) {
					return errors.New("plist dict has a key without a value")
				}
				node.keys = append(node.keys, key)
				continue
			}
			if len(node.keys) != len(node.values)+1 {
				return errors.New("plist dict has a value without a key")
			}
			value, err := decodePlistValue(decoder, element)
			if err != nil {
				return err
			}
			node.values = append(node.values, value)
		}
	}
}

func decodePlistArray(decoder *xml.Decoder, node *plistNode) error {
	for {
		token, err := decoder.Token()
		if err != nil {
			return fmt.Errorf("could not parse plist array: %w", err)
		}
		switch element := token.(type) {
		case xml.EndElement:
			return nil
		case xml.StartElement:
			value, err := decodePlistValue(decoder, element)
			if err != nil {
				return err
			}
			node.values = append(node.values, value)
		}
	}
}

func writePlist(root *plistNode) ([]byte, error) {
	var buffer bytes.Buffer
	buffer.WriteString(plistHeader)
	buffer.WriteString(`<plist version="1.0">` + "\n")
	if err := encodePlistValue(&buffer, root, 0); err != nil {
		return nil, err
	}
	buffer.WriteString("</plist>\n")
	return buffer.Bytes(), nil
}

func encodePlistValue(writer *bytes.Buffer, node *plistNode, depth int) error {
	indent := strings.Repeat("\t", depth)
	switch node.kind {
	case plistDictKind:
		if len(node.keys) == 0 {
			writer.WriteString(indent + "<dict/>\n")
			return nil
		}
		writer.WriteString(indent + "<dict>\n")
		for index, key := range node.keys {
			writer.WriteString(indent + "\t<key>")
			if err := escapePlistText(writer, key); err != nil {
				return err
			}
			writer.WriteString("</key>\n")
			if err := encodePlistValue(writer, node.values[index], depth+1); err != nil {
				return err
			}
		}
		writer.WriteString(indent + "</dict>\n")
	case plistArrayKind:
		if len(node.values) == 0 {
			writer.WriteString(indent + "<array/>\n")
			return nil
		}
		writer.WriteString(indent + "<array>\n")
		for _, value := range node.values {
			if err := encodePlistValue(writer, value, depth+1); err != nil {
				return err
			}
		}
		writer.WriteString(indent + "</array>\n")
	case plistTrueKind, plistFalseKind:
		writer.WriteString(indent + "<" + node.kind + "/>\n")
	default:
		writer.WriteString(indent + "<" + node.kind + ">")
		if err := escapePlistText(writer, node.text); err != nil {
			return err
		}
		writer.WriteString("</" + node.kind + ">\n")
	}
	return nil
}

func escapePlistText(writer io.Writer, text string) error {
	return xml.EscapeText(writer, []byte(text))
}
