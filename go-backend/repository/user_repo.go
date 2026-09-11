package repository

import (
	"colorai-backend/model/entity"

	"gorm.io/gorm"
)

// UserRepository 用户数据访问接口
type UserRepository interface {
	Create(user *entity.User) error
	FindByPhone(phone string) (*entity.User, error)
	ExistsByPhone(phone string) (bool, error)
}

// mysqlUserRepository MySQL 用户数据访问实现
type mysqlUserRepository struct {
	db *gorm.DB
}

// NewUserRepository 创建 UserRepository 实例
func NewUserRepository(db *gorm.DB) UserRepository {
	return &mysqlUserRepository{db: db}
}

func (r *mysqlUserRepository) Create(user *entity.User) error {
	return r.db.Create(user).Error
}

func (r *mysqlUserRepository) FindByPhone(phone string) (*entity.User, error) {
	var user entity.User
	err := r.db.Where("phone = ?", phone).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *mysqlUserRepository) ExistsByPhone(phone string) (bool, error) {
	var count int64
	err := r.db.Model(&entity.User{}).Where("phone = ?", phone).Count(&count).Error
	return count > 0, err
}
