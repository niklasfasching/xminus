package cli

import (
	"bytes"
	_ "embed"
	"fmt"
	"io/ioutil"
	"log"
	"mime"
	"net/http"
	"os"
	"os/exec"
	"path"
	"strings"
)

type Server struct {
	Address    string
	ForwardADB bool
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
				if err == nil && !strings.HasSuffix(r.URL.Path, "/") {
					http.Redirect(w, r, r.URL.Path+"/", 302)
					return
				}
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
			bs = bytes.Replace(bs, []byte("<html>"), []byte("<html>\n"+reloadSnippet), -1)
		}
		w.Write(bs)
	})

	if s.ForwardADB {
		go func() {
			cmd := exec.Command("bash", "-c", fmt.Sprintf(`
              while true; do
                adb wait-for-usb-device reverse tcp:%[1]s tcp:%[1]s
                echo adb: Forwarding %[1]s
                adb wait-for-usb-disconnect
                echo adb: Disconnected
              done`, strings.Split(s.Address, ":")[1]))
			cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
			if err := cmd.Run(); err != nil {
				log.Println("adb", err)
			}
		}()
	}
	log.Println("Listening at http://" + s.Address)
	return s.Server.ListenAndServe()
}
