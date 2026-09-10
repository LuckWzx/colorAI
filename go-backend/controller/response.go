package controller

import (
	"net/http"

	"colorai-backend/service"

	"github.com/gin-gonic/gin"
)

// OK 返回成功响应
func OK(c *gin.Context, data gin.H) {
	data["success"] = true
	c.JSON(http.StatusOK, data)
}

// Created 返回创建成功响应
func Created(c *gin.Context, data gin.H) {
	data["success"] = true
	c.JSON(http.StatusCreated, data)
}

// Fail 返回失败响应
func Fail(c *gin.Context, status int, msg string) {
	c.JSON(status, gin.H{
		"success": false,
		"error":   msg,
	})
}

// HandleServiceError 统一处理 service 层错误
func HandleServiceError(c *gin.Context, err error) {
	if svcErr, ok := err.(*service.ServiceError); ok {
		Fail(c, svcErr.StatusCode, svcErr.Message)
		return
	}
	Fail(c, http.StatusInternalServerError, "服务器内部错误")
}

// Health 健康检查
// GET /api/health
func Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "ok",
	})
}
