package main

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"

	"github.com/niklasfasching/headless"
)

type Runner struct {
	Args       []string
	WindowArgs []string
	fs         fs.FS
	html       string
	headless   headless.H
}

//go:embed assets/run.html
var runHTML string

//go:embed assets/bundle.mjs
var bundleJS string

func (r *Runner) Run(w *Watcher) (int, error) {
	if len(r.Args) == 0 {
		return 0, nil
	}
	runHTML := fmt.Sprintf(runHTML, os.Getenv("CI") == "true")
	r.html = headless.HTML(runHTML, headless.TemplateHTML("", r.Args, r.WindowArgs))
	r.headless.POSTMux = http.DefaultServeMux
	if w == nil {
		return r.run(context.Background(), nil)
	}
	for {
		changed := w.AwaitChange()
		ctx, cancel := context.WithCancel(context.Background())
		go func() {
			<-changed
			cancel()
		}()
		exitCode, err := r.run(ctx, nil)
		log.Printf("\nRun: Finished with %d %v", exitCode, err)
		<-changed
	}
}

func (r *Runner) Bundle(basePath string) (int, error) {
	if len(r.Args) != 2 {
		return 0, fmt.Errorf("-b srcFile dstFile")
	}
	r.headless.POSTMux = http.DefaultServeMux
	r.headless.POSTMux.HandleFunc("/create", headless.CreateHandler)
	r.html = headless.HTML("", headless.TemplateHTML(bundleJS, nil, append(r.Args, basePath)))
	return r.run(context.Background(), nil)
}

func (r *Runner) UpdateFixtures() (int, error) {
	r.headless.POSTMux = http.DefaultServeMux
	updatedFixtures := map[string]string{}
	defer func() {
		for path, fixturePath := range updatedFixtures {
			log.Printf("Updated %s (%s)", fixturePath, path)
		}
	}()
	bs := &bytes.Buffer{}
	f := func(m headless.Message) bool {
		if m.Method == "warning" {
			fmt.Fprint(bs, m.Args...)
			return true
		}
		return false
	}
	runHTML := fmt.Sprintf(runHTML, os.Getenv("CI") == "true")
	r.html = headless.HTML(runHTML, headless.TemplateHTML("", r.Args, append(r.WindowArgs, "update-fixtures")))
	if exitCode, err := r.run(context.Background(), f); exitCode != 0 || err != nil {
		return exitCode, err
	}
	m := map[string]json.RawMessage{}
	if err := json.Unmarshal(bs.Bytes(), &m); err != nil {
		return 0, err
	}
	for fixtureURL, bs := range m {
		lines := strings.Split(string(bs), "\n")
		result := lines[0] + "\n"
		for _, line := range lines[1:] {
			result += line[2:] + "\n"
		}
		log.Println(fixtureURL)
		u, err := url.Parse(fixtureURL)
		if err != nil {
			return 0, err
		}
		fixturePath := path.Join(".", u.Path)
		if err := os.MkdirAll(path.Dir(fixturePath), os.ModePerm); err != nil {
			return 0, err
		}
		if err := os.WriteFile(fixturePath, []byte(result), 0644); err != nil {
			return 0, err
		}
	}
	return 0, nil
}

func (r *Runner) run(ctx context.Context, f func(m headless.Message) bool) (int, error) {
	if err := r.headless.Start(); err != nil {
		return 0, err
	}
	defer r.headless.Stop()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	run := r.headless.Run(ctx, r.html)
	for m := range run.Messages {
		if exit, exitCode, err := r.log(m, f); exit {
			cancel()
			return exitCode, err
		}
	}
	return 0, nil
}

func (r *Runner) log(m headless.Message, f func(m headless.Message) bool) (bool, int, error) {
	if f != nil && f(m) {
		return false, 0, nil
	} else if m.Method == "clear" {
		return true, int(m.Args[0].(float64)), nil
	} else if m.Method == "exception" {
		return true, 0, errors.New(m.Args[0].(string))
	} else if m.Method == "info" {
		fmt.Println(headless.Colorize(m))
	} else if m.Method == "error" {
		fmt.Fprintln(os.Stderr, headless.Colorize(m))
	} else {
		fmt.Println(m.Args...)
	}
	return false, 0, nil
}
