package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/niklasfasching/headless"
)

type Runner struct {
	Address    string
	Args       []string
	WindowArgs []string
	fs         fs.FS
	html       string
}

//go:embed assets/run.mjs
var runJS string

//go:embed assets/bundle.mjs
var bundleJS string

func (r *Runner) Run(w *Watcher) (int, error) {
	if len(r.Args) == 0 {
		return 0, nil
	}
	r.html = headless.TemplateHTML(fmt.Sprintf(runJS, os.Getenv("CI") == "true"), r.Args, r.WindowArgs)
	if w == nil {
		return r.run(context.Background())
	}
	for {
		changed := w.AwaitChange()
		ctx, cancel := context.WithCancel(context.Background())
		go func() {
			<-changed
			cancel()
		}()
		exitCode, err := r.run(ctx)
		log.Printf("\nRun: Finished with %d %v", exitCode, err)
		<-changed
	}
}

func (r *Runner) Bundle(basePath string) (int, error) {
	if len(r.Args) != 2 {
		return 0, fmt.Errorf("-b srcFile dstFile")
	}
	r.html = headless.TemplateHTML(bundleJS, nil, append(r.Args, basePath))
	return r.run(context.Background())
}

func (r *Runner) UpdateFixtures() (int, error) {
	updatedFixtures := map[string]string{}
	defer func() {
		for path, fixturePath := range updatedFixtures {
			log.Printf("Updated %s (%s)", fixturePath, path)
		}
	}()
	r.html = headless.TemplateHTML(
		fmt.Sprintf(runJS, os.Getenv("CI") == "true"),
		r.Args, append(r.WindowArgs, "update-fixtures"))
	return r.run(context.Background())
}

func (r *Runner) run(ctx context.Context) (int, error) {
	h, err := headless.Start(nil)
	if err != nil {
		return 0, err
	}
	defer h.Stop()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	s, err := h.Open("about:blank")
	if err != nil {
		return 0, err
	}
	exitc, errc := make(chan int), make(chan error)
	s.Bind("writeFile", func(path, body string) error {
		path = filepath.Join(".", path)
		if err := os.MkdirAll(filepath.Dir(path), os.ModePerm); err != nil {
			return err
		}
		return os.WriteFile(path, []byte(body), 0644)
	})
	s.Bind("console.log", func(args ...interface{}) { fmt.Fprintln(os.Stdout, headless.Colorize(args)) })
	s.Bind("console.info", func(args ...interface{}) { fmt.Fprintln(os.Stdout, headless.Colorize(args)) })
	s.Bind("console.error", func(args ...interface{}) { fmt.Fprintln(os.Stderr, headless.Colorize(args)) })
	s.Bind("window.close", func(code int) { exitc <- code })
	s.Handle("Runtime.exceptionThrown", func(m json.RawMessage) { errc <- fmt.Errorf(headless.FormatException(m)) })
	if err := s.Open(fmt.Sprintf("http://localhost:%s/run", strings.Split(r.Address, ":")[1])); err != nil {
		return 0, err
	}
	select {
	case <-ctx.Done():
		return 0, nil
	case code := <-exitc:
		return code, nil
	case err := <-errc:
		return 0, err
	}
}
