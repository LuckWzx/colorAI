package service

import (
	"colorai-backend/model/entity"
	"context"
	"crypto/sha256"
	"database/sql"
	"fmt"
	"regexp"
	"strings"
	"time"

	"colorai-backend/repository"

	"github.com/redis/go-redis/v9"
)

const tokenTTL = 7 * 24 * time.Hour

var phoneRe = regexp.MustCompile(`^1[3-9]\d{9}$`)

// AuthService 认证业务接口
type AuthService interface {
	Register(username, phone, password string) (*entity.User, string, error)
	Login(phone, password string) (*entity.User, string, error)
	Logout(token string) error
	ValidateToken(token string) (userID, username, phone string, err error)
	ValidatePhone(phone string) bool
}

type authService struct {
	userRepo repository.UserRepository
	rdb      *redis.Client
}

// NewAuthService 创建 AuthService 实例
func NewAuthService(userRepo repository.UserRepository, rdb *redis.Client) AuthService {
	return &authService{userRepo: userRepo, rdb: rdb}
}

func (s *authService) ValidatePhone(phone string) bool {
	return phoneRe.MatchString(phone)
}

func (s *authService) Register(username, phone, password string) (*entity.User, string, error) {
	// 检查手机号是否已注册
	exists, err := s.userRepo.ExistsByPhone(phone)
	if err != nil {
		return nil, "", fmt.Errorf("查询用户失败: %w", err)
	}
	if exists {
		return nil, "", &ServiceError{StatusCode: 409, Message: "该手机号已注册"}
	}

	// 创建用户
	userID := fmt.Sprintf("u_%d", time.Now().UnixNano())
	passwordHash := hashPassword(password)
	user := &entity.User{
		ID:        userID,
		Username:  username,
		Phone:     phone,
		CreatedAt: time.Now().UnixMilli(),
	}

	if err := s.userRepo.Create(user, passwordHash); err != nil {
		return nil, "", fmt.Errorf("注册失败: %w", err)
	}

	token := s.genToken(userID)
	s.saveToken(token, user)

	return user, token, nil
}

func (s *authService) Login(phone, password string) (*entity.User, string, error) {
	user, storedHash, err := s.userRepo.FindByPhone(phone)
	if err == sql.ErrNoRows {
		return nil, "", &ServiceError{StatusCode: 401, Message: "该手机号尚未注册"}
	}
	if err != nil {
		return nil, "", fmt.Errorf("查询失败: %w", err)
	}

	if storedHash != hashPassword(password) {
		return nil, "", &ServiceError{StatusCode: 401, Message: "密码错误"}
	}

	token := s.genToken(user.ID)
	s.saveToken(token, user)

	return user, token, nil
}

func (s *authService) Logout(token string) error {
	ctx := context.Background()
	s.rdb.Del(ctx, "token:"+token)
	return nil
}

func (s *authService) ValidateToken(token string) (string, string, string, error) {
	ctx := context.Background()
	val, err := s.rdb.Get(ctx, "token:"+token).Result()
	if err != nil {
		return "", "", "", fmt.Errorf("token 无效或已过期")
	}

	parts := strings.SplitN(val, "|", 3)
	if len(parts) < 3 {
		return "", "", "", fmt.Errorf("token 数据格式错误")
	}

	return parts[0], parts[1], parts[2], nil
}

func (s *authService) genToken(userID string) string {
	h := sha256.Sum256([]byte(fmt.Sprintf("%s_%d", userID, time.Now().UnixNano())))
	return fmt.Sprintf("tk_%s_%x", userID, h[:8])
}

func (s *authService) saveToken(token string, user *entity.User) {
	ctx := context.Background()
	val := fmt.Sprintf("%s|%s|%s", user.ID, user.Username, user.Phone)
	s.rdb.Set(ctx, "token:"+token, val, tokenTTL)
}

func hashPassword(pwd string) string {
	h := sha256.Sum256([]byte(pwd))
	return fmt.Sprintf("%x", h)
}

// ServiceError 业务错误类型
type ServiceError struct {
	StatusCode int
	Message    string
}

func (e *ServiceError) Error() string {
	return e.Message
}
