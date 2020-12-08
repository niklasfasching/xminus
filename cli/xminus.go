package main

import (
	"bytes"
	"context"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"mime"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/niklasfasching/goheadless"
)

var listenAddress = flag.String("l", ":8000", "http listen address")
var watchInterval = flag.Int("i", 500, "directory watch poll interval in ms")
var exitAfterRun = flag.Bool("e", false, "exit after run")
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

	*http.Server
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

	if *exitAfterRun {
		r.Watcher = nil
		r.Start()
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
			log.Println("\n\n")
			if err != nil {
				log.Println("Error traversing directory. Updating...\n")
			} else {
				log.Println("Directory changed. Updating...\n")
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

func (w *Watcher) AwaitChange() {
	w.Lock()
	c := make(chan struct{})
	w.subscribers = append(w.subscribers, c)
	w.Unlock()
	<-c
}

func (s *Server) Start() error {
	mux := &http.ServeMux{}
	if strings.HasPrefix(s.Address, ":") {
		s.Address = "localhost" + s.Address
	}
	s.Server = &http.Server{Addr: s.Address, Handler: mux}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" && r.Method == "POST" {
			s.Watcher.AwaitChange()
			w.WriteHeader(http.StatusNoContent)
			return
		}

		bs := []byte{}
		if r.URL.Path == "/run" {
			tmp := httptest.NewRecorder()
			r.URL.Path = "/"
			s.Runner.Handler.ServeHTTP(tmp, r)
			bs = tmp.Body.Bytes()
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

func (r *Runner) Start() {
	if len(r.Paths) == 0 {
		return
	}
	address := "localhost:" + goheadless.GetFreePort()
	r.Server = goheadless.Serve(address, r.Paths, r.Args)
	for {
		out, done := make(chan goheadless.Event), make(chan struct{})
		ctx, cancel := context.WithCancel(context.Background())
		go func() {
			for event := range out {
				if event.Method == "info" {
					fmt.Println(goheadless.Colorize(event))
				} else {
					fmt.Println(event.Args...)
				}

			}
			close(done)
		}()
		go func() {
			exitCode, err := goheadless.Run(ctx, out, "http://"+address)
			<-done
			if r.Watcher == nil {
				if err != nil {
					log.Fatal(err)
				}
				os.Exit(exitCode)
			} else {
				log.Printf("\nRun: Finished with %d %v", exitCode, err)
			}
		}()
		if r.Watcher == nil {
			select {} // wait for call to f()
		}
		r.Watcher.AwaitChange()
		cancel()
	}
}
