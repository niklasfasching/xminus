package main

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"io/ioutil"
	"log"
	"mime"
	"net/http"
	"path"
	"strings"
)

type Server struct {
	Address string
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
	s.Server = &http.Server{Addr: s.Address, Handler: mux}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" && r.Method == "POST" {
			<-s.Watcher.AwaitChange()
			w.WriteHeader(http.StatusNoContent)
			return
		} else if r.Method == "POST" {
			w.Header().Set("Content-Type", "application/json")
			is, _ := ioutil.ReadDir(path.Join("./", r.URL.Path))
			files := []string{}
			for _, i := range is {
				files = append(files, i.Name())
			}
			json.NewEncoder(w).Encode(files)
			return
		}
		bs := []byte{}
		if r.URL.Path == "/run" {
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
	return s.Server.ListenAndServe()
}
