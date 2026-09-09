package handlers

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"fmt"
	"net/http"
	"regexp"
	"time"

	"colorai-backend/database"
	"colorai-backend/models"

	"github.com/gin-gonic/gin"
)

var phoneRe = regexp.MustCompile(`^1[3-9]\d{9}$`)

const tokenTTL = 7 * 24 * time.Hour // token 有效期 7 天

// hashPassword SHA-256 哈希密码
func hashPassword(pwd string) string {
	h := sha256.Sum256([]byte(pwd))
	return fmt.Sprintf("%x", h)
}

// genToken 生成随机 token
func genToken(userID string) string {
	h := sha256.Sum256([]byte(fmt.Sprintf("%s_%d", userID, time.Now().UnixNano())))
	return fmt.Sprintf("tk_%s_%x", userID, h[:8])
}

// saveToken 将 token 存入 Redis，key=token, value=用户信息 JSON
func saveToken(token string, user *models.User) {
	ctx := context.Background()
	// 用简单 JSON: id|username|phone
	val := fmt.Sprintf("%s|%s|%s", user.ID, user.Username, user.Phone)
	database.RDB.Set(ctx, "token:"+token, val, tokenTTL)
}

// AuthRegister 用户注册
// POST /api/auth/register
func AuthRegister(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.AuthResponse{
			Success: false,
			Error:   "参数校验失败: " + err.Error(),
		})
		return
	}

	if !phoneRe.MatchString(req.Phone) {
		c.JSON(http.StatusBadRequest, models.AuthResponse{
			Success: false,
			Error:   "手机号格式不正确",
		})
		return
	}

	// 检查手机号是否已注册
	var exists int
	database.DB.QueryRow("SELECT COUNT(*) FROM users WHERE phone = ?", req.Phone).Scan(&exists)
	if exists > 0 {
		c.JSON(http.StatusConflict, models.AuthResponse{
			Success: false,
			Error:   "该手机号已注册",
		})
		return
	}

	// 创建用户
	userID := fmt.Sprintf("u_%d", time.Now().UnixNano())
	passwordHash := hashPassword(req.Password)

	_, err := database.DB.Exec(
		"INSERT INTO users (id, username, phone, password_hash) VALUES (?, ?, ?, ?)",
		userID, req.Username, req.Phone, passwordHash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.AuthResponse{
			Success: false,
			Error:   "注册失败: " + err.Error(),
		})
		return
	}

	token := genToken(userID)
	user := models.User{
		ID:        userID,
		Username:  req.Username,
		Phone:     req.Phone,
		CreatedAt: time.Now().UnixMilli(),
	}

	// 存入 Redis
	saveToken(token, &user)

	c.JSON(http.StatusOK, models.AuthResponse{
		Success: true,
		User:    &user,
		Token:   token,
	})
}

// AuthLogin 用户登录
// POST /api/auth/login
func AuthLogin(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.AuthResponse{
			Success: false,
			Error:   "参数校验失败: " + err.Error(),
		})
		return
	}

	if !phoneRe.MatchString(req.Phone) {
		c.JSON(http.StatusBadRequest, models.AuthResponse{
			Success: false,
			Error:   "手机号格式不正确",
		})
		return
	}

	// 查询用户
	var user models.User
	var createdAt time.Time
	err := database.DB.QueryRow(
		"SELECT id, username, phone, COALESCE(avatar,''), created_at FROM users WHERE phone = ?",
		req.Phone,
	).Scan(&user.ID, &user.Username, &user.Phone, &user.Avatar, &createdAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, models.AuthResponse{
			Success: false,
			Error:   "该手机号尚未注册",
		})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, models.AuthResponse{
			Success: false,
			Error:   "查询失败: " + err.Error(),
		})
		return
	}
	user.CreatedAt = createdAt.UnixMilli()

	// 验证密码
	var passwordHash string
	database.DB.QueryRow("SELECT password_hash FROM users WHERE phone = ?", req.Phone).Scan(&passwordHash)
	if passwordHash != hashPassword(req.Password) {
		c.JSON(http.StatusUnauthorized, models.AuthResponse{
			Success: false,
			Error:   "密码错误",
		})
		return
	}

	token := genToken(user.ID)

	// 存入 Redis
	saveToken(token, &user)

	c.JSON(http.StatusOK, models.AuthResponse{
		Success: true,
		User:    &user,
		Token:   token,
	})
}

// AuthLogout 用户登出 - 从 Redis 删除 token
// POST /api/auth/logout
func AuthLogout(c *gin.Context) {
	// 从 Authorization header 取 token
	token := c.GetHeader("Authorization")
	if token != "" {
		// 去掉 "Bearer " 前缀
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}
		ctx := context.Background()
		database.RDB.Del(ctx, "token:"+token)
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Success: true})
}
