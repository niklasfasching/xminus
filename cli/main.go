package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path"
	"strings"
	"time"
)

var listenAddress = flag.String("l", ":8000", "http listen address")
var remoteListenAddress = flag.String("rl", "", "remote forward host:port pair for ssh -L")
var watch = flag.Bool("w", false, "watch and re-run on change")
var watchInterval = flag.Int("i", 500, "watch poll interval in ms")
var updateFixtures = flag.Bool("u", false, "update test fixtures")
var bundle = flag.Bool("b", false, "bundle srcFile dstFile")
var bundleBasePath = flag.String("bp", "/", "bundle rooted basePath (e.g. github pages project root /xminus)")
var create = flag.Bool("c", false, "scaffold [module|app] dst [name]")
var windowArgs = flag.String("a", "", "window.args = strings.Fields(a) inside executed files")

func main() {
	log.SetFlags(0)
	flag.Usage = func() {
		fmt.Printf("Usage: %s [...runFiles]\n", os.Args[0])
		flag.PrintDefaults()
	}
	flag.Parse()

	w := &Watcher{Path: "./", Interval: time.Duration(*watchInterval) * time.Millisecond}
	r := &Runner{Args: flag.Args(), WindowArgs: strings.Fields(*windowArgs)}
	s := &Server{Address: *listenAddress, RemoteAddress: *remoteListenAddress, Watcher: w, Runner: r}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		is, _ := ioutil.ReadDir(path.Join("./", r.URL.Path))
		files := []string{}
		for _, i := range is {
			files = append(files, i.Name())
		}
		json.NewEncoder(w).Encode(files)
	})

	if *updateFixtures {
		exitCode, err := r.UpdateFixtures()
		if err != nil {
			log.Fatal(err)
		}
		os.Exit(exitCode)
	} else if *watch {
		go w.Start()
		go r.Run(w)
		log.Fatal(s.Start())
	} else if *bundle {
		exitCode, err := r.Bundle(*bundleBasePath)
		if err != nil {
			log.Fatal(err)
		}
		os.Exit(exitCode)
	} else if *create {
		if err := CreateScaffold(flag.Args()); err != nil {
			log.Fatal(err)
		}
		os.Exit(0)
	} else {
		exitCode, err := r.Run(nil)
		if err != nil {
			log.Fatal(err)
		}
		os.Exit(exitCode)
	}
}
