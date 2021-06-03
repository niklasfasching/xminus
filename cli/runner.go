package main

import (
	"bytes"
	"context"
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
	Paths []string
	Args  []string
	*Watcher
	fs       fs.FS
	html     string
	headless headless.H
}

var setupHTML = fmt.Sprintf(`
<script type=module>
window.isCI = %v;
window.isHeadless = navigator.webdriver;
window.close = (code = 0) => isHeadless ? console.clear(code) : console.log("exit:", code);
window.openIframe = (src) => {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    const onerror = reject;
    const onload = () => resolve(iframe);
    document.body.appendChild(Object.assign(iframe, {onload, onerror, src}));
  });
};
</script>`, os.Getenv("CI") == "true")

func (r *Runner) Start() (int, error) {
	if len(r.Paths) == 0 {
		return 0, nil
	}
	r.html = headless.HTML(setupHTML, headless.TemplateHTML("", r.Paths, r.Args))
	r.headless.POSTMux = http.DefaultServeMux
	if err := r.headless.Start(); err != nil {
		return 0, err
	}
	defer r.headless.Stop()
	if r.Watcher == nil {
		return r.run(context.Background(), nil)
	}
	for {
		changed := r.Watcher.AwaitChange()
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

func (r *Runner) UpdateFixtures() (int, error) {
	r.headless.POSTMux = http.DefaultServeMux
	if err := r.headless.Start(); err != nil {
		return 0, err
	}
	defer r.headless.Stop()
	updatedFixtures := map[string]string{}
	defer func() {
		for path, fixturePath := range updatedFixtures {
			log.Printf("Updated %s (%s)", fixturePath, path)
		}
	}()
	r.html = headless.HTML(setupHTML, headless.TemplateHTML("", r.Paths, append(r.Args, "update-fixtures")))
	bs := &bytes.Buffer{}
	f := func(m headless.Message) bool {
		if m.Method == "warning" {
			fmt.Fprint(bs, m.Args...)
			return true
		}
		return false
	}
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
