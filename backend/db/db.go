package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

// InitDB connects to PostgreSQL if databaseURL is non-empty, and runs schema migrations if needed.
func InitDB(databaseURL string) (*sql.DB, error) {
	if databaseURL == "" {
		databaseURL = os.Getenv("DATABASE_URL")
	}
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL not set")
	}

	database, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open postgres database: %w", err)
	}

	if err := database.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping postgres database: %w", err)
	}

	log.Println("Connected to PostgreSQL database successfully")

	// Apply schema if schema.sql exists
	if schemaBytes, err := os.ReadFile("db/schema.sql"); err == nil {
		if _, err := database.Exec(string(schemaBytes)); err != nil {
			log.Printf("Warning: postgres schema execution notice/err: %v", err)
		}
	}

	return database, nil
}
