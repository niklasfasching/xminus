package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/niklasfasching/xminus/cli"
)

var listenAddress = flag.String("l", ":8000", "http listen address")
var forwardADB = flag.Bool("f", false, "forward listenAddress to adb device")
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

	if *create {
		if err := cli.CreateScaffold(flag.Args()); err != nil {
			log.Fatal(err)
		}
		os.Exit(0)
	}

	w := &cli.Watcher{Path: "./", Interval: time.Duration(*watchInterval) * time.Millisecond}
	r := &cli.Runner{Args: flag.Args(), WindowArgs: strings.Fields(*windowArgs), Address: *listenAddress}
	s := &cli.Server{Address: *listenAddress, ForwardADB: *forwardADB, Watcher: w, Runner: r}
	go func() { log.Fatal(s.Start()) }()
	if *updateFixtures {
		exitCode, err := r.UpdateFixtures()
		if err != nil {
			log.Fatal(err)
		}
		os.Exit(exitCode)
	} else if *watch {
		go w.Start()
		r.Run(w)
	} else if *bundle {
		exitCode, err := r.Bundle(*bundleBasePath)
		if err != nil {
			log.Fatal(err)
		}
		os.Exit(exitCode)
	} else {
		exitCode, err := r.Run(nil)
		if err != nil {
			log.Fatal(err)
		}
		os.Exit(exitCode)
	}
}
