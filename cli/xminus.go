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
var runFile = flag.String("r", "", "script file to run in headless browser")
var exitAfterRun = flag.Bool("e", false, "exit after run")

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
	Path string
	*Watcher

	servePath string
	*http.Server
}

func main() {
	log.SetFlags(0)
	flag.Parse()
	flags := map[string]bool{}
	flag.Visit(func(f *flag.Flag) { flags[f.Name] = true })

	w := &Watcher{Path: "./", Interval: time.Duration(*watchInterval) * time.Millisecond}
	r := &Runner{Path: *runFile, Watcher: w}
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
	s.Server = &http.Server{Addr: s.Address, Handler: mux}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" && r.Method == "POST" {
			s.Watcher.AwaitChange()
			w.WriteHeader(http.StatusNoContent)
			return
		}

		bs := []byte{}
		if r.URL.Path == s.Runner.servePath {
			tmp := httptest.NewRecorder()
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

	addr := s.Addr
	if strings.HasPrefix(addr, ":") {
		addr = "localhost" + addr
	}
	log.Println("Listening at http://" + addr)
	return s.Server.ListenAndServe()
}

func (r *Runner) Start() {
	if r.Path == "" {
		return
	}
	address := "localhost:" + goheadless.GetFreePort()
	servePath, fileName := goheadless.SplitPath(r.Path)
	r.Server = goheadless.Serve(address, servePath, fileName, flag.Args())
	r.servePath = servePath
	for {
		out, done := make(chan goheadless.Event), make(chan struct{})
		ctx, cancel := context.WithCancel(context.Background())
		go func() {
			for event := range out {
				fmt.Println(goheadless.Colorize(event))
			}
			close(done)
		}()
		go func() {
			exitCode, err := goheadless.Run(ctx, out, "http://"+address+servePath)
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
