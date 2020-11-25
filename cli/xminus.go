package main

import (
	"bytes"
	"flag"
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

	*http.Server
}

type Runner struct {
	Path string
	*Watcher
}

func main() {
	log.SetFlags(0)
	flag.Parse()
	flags := map[string]bool{}
	flag.Visit(func(f *flag.Flag) { flags[f.Name] = true })

	w := &Watcher{Path: "./", Interval: time.Duration(*watchInterval) * time.Millisecond}
	s := &Server{Address: *listenAddress, Watcher: w}
	r := &Runner{Path: *runFile, Watcher: w}

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

		p := path.Join("./", path.Clean(r.URL.Path))
		bs, err := ioutil.ReadFile(p)
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
		contentType := mime.TypeByExtension(path.Ext(p))
		if contentType == "" {
			contentType = http.DetectContentType(bs)
		}
		w.Header().Set("Content-Type", contentType)
		if strings.HasPrefix(contentType, "text/html") {
			bs = bytes.Replace(bs, []byte("</head>"), []byte(reloadSnippet+"\n</head>"), -1)
		}
		w.Write(bs)
	})
	log.Println("Starting server at " + s.Addr)
	return s.Server.ListenAndServe()
}

func (r *Runner) Start() {
	if r.Path == "" {
		return
	}
	address, f := "localhost:"+goheadless.GetFreePort(), func() {}
	servePath, fileName := goheadless.SplitPath(r.Path)
	for {
		out := make(chan string)
		go func() {
			for msg := range out {
				log.Println(msg)
			}
			f()
		}()
		exitCode, err := goheadless.ServeAndRun(out, address, servePath, fileName, flag.Args())
		f = func() {
			if err != nil {
				panic(err)
			} else if r.Watcher == nil {
				os.Exit(exitCode)
			} else {
				log.Printf("Run: Finished with %d", exitCode)
			}
		}
		if r.Watcher == nil {
			select {} // wait for call to f()
		}
		r.Watcher.AwaitChange()
	}
}
