package repository

import (
	"g/api/internal/models"
)

type AlbumRepository interface {
	GetAlbum() (*models.Album, error)
}

type userRepository struct {
	// db could be a database connection or ORM instance
	db *DatabaseConnection
}

func NewUserRepository(db *DatabaseConnection) AlbumRepository {
	return & {db: db}
}

func (r *userRepository) GetAlbums() {
	return r.db.get()
}
