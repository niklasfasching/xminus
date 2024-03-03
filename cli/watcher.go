package cli

import (
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Watcher struct {
	Path     string
	Interval time.Duration

	sync.Mutex
	subscribers []chan struct{}
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
