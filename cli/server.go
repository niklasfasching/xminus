package main

import (
	"bytes"
	_ "embed"
	"io/fs"
	"io/ioutil"
	"log"
	"mime"
	"net/http"
	"os"
	"os/exec"
	"path"
	"strings"

	"github.com/niklasfasching/headless"
)

type Server struct {
	Address, RemoteAddress string
	*Watcher
	*Runner

	*http.Server
}

//go:embed assets/reload.html
var reloadSnippet string

func (s *Server) Start() error {
	mux := &http.ServeMux{}
	if strings.HasPrefix(s.Address, ":") {
		s.Address = "localhost" + s.Address
	}
	if s.RemoteAddress != "" && !strings.Contains(s.RemoteAddress, ":") {
		s.RemoteAddress += ":" + strings.Split(s.Address, ":")[1]
	}
	s.Server = &http.Server{Addr: s.Address, Handler: mux}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" && r.Method == "POST" {
			<-s.Watcher.AwaitChange()
			w.WriteHeader(http.StatusNoContent)
			return
		} else if r.Method == "POST" {
			http.DefaultServeMux.ServeHTTP(w, r)
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
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Expires", "0")
		w.Header().Set("Content-Type", contentType)
		if strings.HasPrefix(contentType, "text/html") {
			bs = bytes.Replace(bs, []byte("</head>"), []byte(reloadSnippet+"\n</head>"), -1)
		}
		w.Write(bs)
	})
	log.Println("Listening at http://" + s.Address)
	if s.RemoteAddress != "" {
		log.Println("Listening at http://" + s.RemoteAddress)
		go s.Server.ListenAndServe()
		return s.forwardRemote()
	}
	return s.Server.ListenAndServe()
}

func (s *Server) forwardRemote() error {
	host := strings.Split(s.RemoteAddress, ":")[0]
	cmd := exec.Command("ssh", "-o", "ExitOnForwardFailure=yes", "-R", s.RemoteAddress+":"+s.Address, host, "sleep infinity")
	cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
	return cmd.Run()
}
