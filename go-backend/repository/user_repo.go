package repository

import (
	"database/sql"
	"time"

	"colorai-backend/models"
)

// UserRepository 用户数据访问接口
type UserRepository interface {
	Create(user *models.User, passwordHash string) error
	FindByPhone(phone string) (*models.User, string, error)
	ExistsByPhone(phone string) (bool, error)
}

// mysqlUserRepository MySQL 用户数据访问实现
type mysqlUserRepository struct {
	db *sql.DB
}

// NewUserRepository 创建 UserRepository 实例
func NewUserRepository(db *sql.DB) UserRepository {
	return &mysqlUserRepository{db: db}
}

func (r *mysqlUserRepository) Create(user *models.User, passwordHash string) error {
	_, err := r.db.Exec(
		"INSERT INTO users (id, username, phone, password_hash) VALUES (?, ?, ?, ?)",
		user.ID, user.Username, user.Phone, passwordHash,
	)
	return err
}

func (r *mysqlUserRepository) FindByPhone(phone string) (*models.User, string, error) {
	var user models.User
	var passwordHash string
	var createdAt time.Time

	err := r.db.QueryRow(
		"SELECT id, username, phone, COALESCE(avatar,''), created_at, password_hash FROM users WHERE phone = ?",
		phone,
	).Scan(&user.ID, &user.Username, &user.Phone, &user.Avatar, &createdAt, &passwordHash)

	if err == sql.ErrNoRows {
		return nil, "", sql.ErrNoRows
	}
	if err != nil {
		return nil, "", err
	}

	user.CreatedAt = createdAt.UnixMilli()
	return &user, passwordHash, nil
}

func (r *mysqlUserRepository) ExistsByPhone(phone string) (bool, error) {
	var count int
	err := r.db.QueryRow("SELECT COUNT(*) FROM users WHERE phone = ?", phone).Scan(&count)
	return count > 0, err
}
