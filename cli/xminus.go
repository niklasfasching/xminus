package main

import (
	"bytes"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"io/ioutil"
	"log"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/niklasfasching/headless"
)

var listenAddress = flag.String("l", ":8000", "http listen address")
var watchInterval = flag.Int("i", 500, "directory watch poll interval in ms")
var exitAfterRun = flag.Bool("e", false, "exit after run")
var updateFixtures = flag.Bool("u", false, "update test fixtures and exit")
var windowArgs = flag.String("a", "", "window.args available inside run (split into strings.Fields)")

var reloadSnippet = `
<script>
  // THIS SNIPPET IS NOT PART OF THE ORIGINAL HTML BUT INSERTED BY THE SERVER
  function longpoll() {
    fetch("/", {method: "POST"}).then(r => {
      if (r.status === 204) location.reload();
      else setTimeout(longpoll, 100);
    }, () => setTimeout(longpoll, 100));
  }
  longpoll();
</script>`

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

type Watcher struct {
	Path     string
	Interval time.Duration

	sync.Mutex
	subscribers []chan struct{}
}

type Server struct {
	Address string
	*Watcher
	*Runner

	*http.Server
}

type Runner struct {
	Paths []string
	Args  []string
	*Watcher
	fs       fs.FS
	html     string
	headless headless.H
}

func main() {
	log.SetFlags(0)
	flag.Usage = func() {
		fmt.Printf("Usage: %s [...runFiles]\n", os.Args[0])
		flag.PrintDefaults()
	}
	flag.Parse()
	w := &Watcher{Path: "./", Interval: time.Duration(*watchInterval) * time.Millisecond}
	r := &Runner{Paths: flag.Args(), Watcher: w, Args: strings.Fields(*windowArgs)}
	s := &Server{Address: *listenAddress, Watcher: w, Runner: r}

	if *updateFixtures {
		exitCode, err := r.UpdateFixtures()
		if err != nil {
			log.Fatal(err)
		}
		os.Exit(exitCode)
	} else if *exitAfterRun {
		r.Watcher = nil
		exitCode, err := r.Start()
		if err != nil {
			log.Fatal(err)
		}
		os.Exit(exitCode)
	} else {
		go w.Start()
		go r.Start()
		log.Fatal(s.Start())
	}
}

func (w *Watcher) Start() {
	previousSum := int64(0)
	for {
		sum := int64(0)
		err := filepath.Walk(w.Path, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if info.IsDir() && info.Name() == ".git" {
				return filepath.SkipDir
			}
			sum += info.ModTime().Unix()
			return nil
		})
		if (previousSum == 0 || previousSum == sum) && err == nil {
			previousSum = sum
		} else {
			if err != nil {
				log.Println("Error traversing directory. Updating...")
			} else {
				log.Println("Directory changed. Updating...")
			}
			previousSum = sum
			w.Lock()
			for _, c := range w.subscribers {
				close(c)
			}
			w.subscribers = w.subscribers[:0]
			w.Unlock()
		}
		time.Sleep(w.Interval)
	}
}

func (w *Watcher) AwaitChange() chan struct{} {
	w.Lock()
	c := make(chan struct{})
	w.subscribers = append(w.subscribers, c)
	w.Unlock()
	return c
}

func (s *Server) Start() error {
	mux := &http.ServeMux{}
	if strings.HasPrefix(s.Address, ":") {
		s.Address = "localhost" + s.Address
	}
	s.Server = &http.Server{Addr: s.Address, Handler: mux}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" && r.Method == "POST" {
			<-s.Watcher.AwaitChange()
			w.WriteHeader(http.StatusNoContent)
			return
		}

		bs := []byte{}
		if strings.HasPrefix(r.URL.Path, "/_headless/") {
			bs, _ = fs.ReadFile(headless.Etc, strings.TrimPrefix(r.URL.Path, "/_headless/"))
		} else if r.URL.Path == "/run" {
			bs = []byte(s.Runner.html)
		} else {
			p, err := path.Join("./", path.Clean(r.URL.Path)), error(nil)
			bs, err = ioutil.ReadFile(p)
			if err != nil {
				if !strings.HasSuffix(p, "/") {
					p += "/"
				}
				p += "index.html"
				bs, err = ioutil.ReadFile(p)
			}
			if err != nil {
				w.WriteHeader(http.StatusNotFound)
				return
			}
		}

		contentType := mime.TypeByExtension(path.Ext(r.URL.Path))
		if contentType == "" {
			contentType = http.DetectContentType(bs)
		}
		w.Header().Set("Content-Type", contentType)
		if strings.HasPrefix(contentType, "text/html") {
			bs = bytes.Replace(bs, []byte("</head>"), []byte(reloadSnippet+"\n</head>"), -1)
		}
		w.Write(bs)
	})
	log.Println("Listening at http://" + s.Address)
	return s.Server.ListenAndServe()
}

func (r *Runner) Start() (int, error) {
	if len(r.Paths) == 0 {
		return 0, nil
	}
	r.html = headless.HTML(setupHTML, headless.TemplateHTML("", r.Paths, r.Args))
	if err := r.headless.Start(); err != nil {
		return 0, err
	}
	defer r.headless.Stop()
	if r.Watcher == nil {
		return r.run(context.Background(), os.Stdout, os.Stderr)
	}
	for {
		changed := r.Watcher.AwaitChange()
		ctx, cancel := context.WithCancel(context.Background())
		go func() {
			<-changed
			cancel()
		}()
		exitCode, err := r.run(ctx, os.Stdout, os.Stderr)
		log.Printf("\nRun: Finished with %d %v", exitCode, err)
		<-changed
	}
}

func (r *Runner) UpdateFixtures() (int, error) {
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
	for _, p := range r.Paths {
		r.html = headless.HTML(setupHTML, headless.TemplateHTML("", []string{p}, append(r.Args, "update-fixtures")))
		out := &bytes.Buffer{}
		if exitCode, err := r.run(context.Background(), out, os.Stderr); exitCode != 0 || err != nil {
			return exitCode, err
		}
		fixturePath := filepath.Join(filepath.Dir(p), "fixtures", filepath.Base(p[:len(p)-len(filepath.Ext(p))])+".json")
		if err := os.MkdirAll(filepath.Join(filepath.Dir(p), "fixtures"), os.ModePerm); err != nil {
			return 0, err
		}
		if err := os.WriteFile(fixturePath, out.Bytes(), os.ModePerm); err != nil {
			return 0, err
		}
		updatedFixtures[p] = fixturePath
	}
	return 0, nil
}

func (r *Runner) run(ctx context.Context, stdout, stderr io.Writer) (int, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	run := r.headless.Run(ctx, r.html)
	for m := range run.Messages {
		if exit, exitCode, err := r.log(m, stdout, stderr); exit {
			cancel()
			return exitCode, err
		}
	}
	return 0, nil
}

func (r *Runner) log(m headless.Message, stdout, stderr io.Writer) (bool, int, error) {
	if m.Method == "clear" {
		return true, int(m.Args[0].(float64)), nil
	} else if m.Method == "exception" {
		return true, 0, errors.New(m.Args[0].(string))
	} else if m.Method == "info" {
		fmt.Fprintln(stdout, headless.Colorize(m))
	} else if m.Method == "error" {
		fmt.Fprintln(stderr, headless.Colorize(m))
	} else {
		fmt.Fprintln(stdout, m.Args...)
	}
	return false, 0, nil
}
