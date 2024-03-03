package main

import (
	"bytes"
	"embed"
	_ "embed"
	"fmt"
	"html/template"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"
	"unicode"
)

//go:embed assets/templates
var templates embed.FS

func CreateScaffold(args []string) error {
	templates, _ := fs.Sub(templates, "assets/templates")
	xs, err := fs.ReadDir(templates, ".")
	if err != nil {
		return err
	}
	m, ks := map[string]*template.Template{}, []string{}
	for _, x := range xs {
		if name := x.Name(); filepath.Ext(name) == ".html" {
			k := strings.TrimSuffix(name, ".html")
			bs, err := fs.ReadFile(templates, name)
			if err != nil {
				return err
			}
			t, err := template.New(k).Parse(string(bs))
			if err != nil {
				return err
			}
			m[k], ks = t, append(ks, k)
		}
	}
	if len(args) == 0 || len(args) > 2 {
		log.Printf("Available templates: {%s}", strings.Join(ks, ","))
		return fmt.Errorf("USAGE: TEMPLATE [PATH]")
	}
	k, dir := args[0], "."
	if len(args) == 2 {
		dir = args[1]
	}
	t := m[k]
	if t == nil {
		return fmt.Errorf("template '%s' not found in {%s}", k, strings.Join(ks, ","))
	}
	fs, ts := []string{}, []*template.Template{}
	for _, t := range t.Templates() {
		name := t.Name()
		if strings.HasPrefix(name, "/") {
			fs, ts = append(fs, filepath.Join(dir, name)), append(ts, t)
		}
	}
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		return err
	}
	if xs, _ := os.ReadDir(dir); len(xs) != 0 {
		log.Println("Directory is not empty. Do you want to create the following files:")
		log.Println("  " + strings.Join(fs, "\n  "))
		fmt.Print("\n(y/N) ")
		in := ""
		_, err := fmt.Scanln(&in)
		if err != nil {
			return err
		}
		if in := strings.ToLower(in); in != "y" {
			return fmt.Errorf("aborted")
		}
	}
	dir, err = filepath.Abs(dir)
	if err != nil {
		return fmt.Errorf("expand dir: %w", err)
	}
	for i, t := range ts {
		b, d, f := &bytes.Buffer{}, map[string]interface{}{"name": filepath.Base(dir)}, fs[i]
		if err := t.Execute(b, d); err != nil {
			return fmt.Errorf("%s execute: %w", f, err)
		}
		if err := os.MkdirAll(filepath.Dir(f), os.ModePerm); err != nil {
			return fmt.Errorf("%s mkdir: %w", f, err)
		}
		if err := os.WriteFile(f, []byte(strings.TrimLeftFunc(string(b.Bytes()), unicode.IsSpace)), 0644); err != nil {
			return fmt.Errorf("%s write: %w", f, err)
		}
	}
	log.Println("\nDone. Created the following files:\n  " + strings.Join(fs, "\n  "))
	return nil
}
