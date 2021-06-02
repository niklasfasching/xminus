package main

import (
	"bytes"
	_ "embed"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"text/template"
)

//go:embed assets/template.html
var templateHTML string

func CreateScaffold(args []string) error {
	if len(args) < 2 || (args[0] != "module" && args[0] != "app") {
		return fmt.Errorf("-c {module|app} path [name]")
	}
	path, err := filepath.Abs(args[0])
	if err != nil {
		return err
	}
	t, err := template.New("index.html").Parse(templateHTML)
	if err != nil {
		return err
	}
	name, isModule := filepath.Base(path), args[0] == "module"
	if len(args) >= 2 {
		name = args[1]
	}
	b, m := &bytes.Buffer{}, map[string]interface{}{"module": isModule, "name": name}
	if err := t.Execute(b, m); err != nil {
		return err
	}
	indexPath, cssPath := filepath.Join(path, "index.html"), filepath.Join(path, name+".css")
	if err := os.MkdirAll(filepath.Dir(indexPath), os.ModePerm); err != nil {
		return err
	}
	if _, err := os.Stat(indexPath); !os.IsNotExist(err) {
		return fmt.Errorf("%s already exists", indexPath)
	}
	if err := os.WriteFile(indexPath, b.Bytes(), 0644); err != nil {
		return err
	}
	if _, err := os.Stat(cssPath); !os.IsNotExist(err) {
		return fmt.Errorf("%s already exists", cssPath)
	}
	if err := os.WriteFile(cssPath, nil, 0644); err != nil {
		return err
	}
	if isModule {
		log.Println("Created module", name)
	} else {
		log.Println("Created app", name)
	}
	log.Println(indexPath)
	log.Println(cssPath)
	return nil
}
