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
var watchInterval = flag.Int("i", 500, "directory watch poll interval in ms")
var exitAfterRun = flag.Bool("e", false, "exit after run")
var updateFixtures = flag.Bool("u", false, "update test fixtures and exit")
var windowArgs = flag.String("a", "", "window.args available inside run (split into strings.Fields)")

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
