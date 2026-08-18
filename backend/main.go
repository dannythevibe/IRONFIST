package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/ironfist/ironfist-backend/api"
	"github.com/ironfist/ironfist-backend/limiter"
	"github.com/ironfist/ironfist-backend/matcher"
	"github.com/redis/go-redis/v9"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	redisAddr := os.Getenv("REDIS_URL")
	var rdb *redis.Client
	if redisAddr != "" {
		opt, err := redis.ParseURL(redisAddr)
		if err == nil {
			rdb = redis.NewClient(opt)
			if err := rdb.Ping(context.Background()).Err(); err != nil {
				log.Printf("Warning: Redis ping failed (%v), falling back to atomic in-memory limiter\n", err)
				rdb = nil
			} else {
				log.Println("Connected to Redis successfully")
			}
		}
	} else {
		log.Println("REDIS_URL not set; running with atomic in-memory token bucket limiter")
	}

	tbLimiter := limiter.NewTokenBucketLimiter(rdb)
	graphMatcher := matcher.NewFuzzyGraphMatcher("ironfist_graph_store.json")
	srv := api.NewServer(tbLimiter, graphMatcher)

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-IronFist-Key"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","engine":"IronFist Edge Gateway v2.0"}`))
	})

	r.Get("/v1/collect-local-traits", srv.HandleCollectLocalTraits)
	r.Post("/v1/verify-trial", srv.HandleVerifyTrial)
	r.Post("/v1/token-bucket/check", srv.HandleCheckTokenBucket)
	r.Post("/v1/override-user", srv.HandleOverrideUser)
	r.Get("/v1/graph", srv.HandleGetGraph)
	r.Get("/v1/live-feed", srv.HandleGetLiveFeed)
	r.Get("/v1/workspaces", srv.HandleWorkspaces)
	r.Post("/v1/workspaces", srv.HandleWorkspaces)

	log.Printf("IronFist Edge Gateway starting on http://localhost:%s ...", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
