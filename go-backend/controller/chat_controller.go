package controller

import (
	"net/http"

	"colorai-backend/models"
	"colorai-backend/service"

	"github.com/gin-gonic/gin"
)

// ChatController AI 对话 HTTP 处理器
type ChatController struct {
	chatSvc service.ChatService
}

// NewChatController 创建 ChatController 实例
func NewChatController(chatSvc service.ChatService) *ChatController {
	return &ChatController{chatSvc: chatSvc}
}

// Chat AI 对话
// POST /api/chat
func (h *ChatController) Chat(c *gin.Context) {
	var req models.ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.Messages) == 0 {
		Fail(c, http.StatusBadRequest, "Invalid request: messages array is required")
		return
	}

	resp, err := h.chatSvc.Chat(req.Messages, req.Model)
	if err != nil {
		Fail(c, http.StatusServiceUnavailable, err.Error())
		return
	}

	if !resp.Success {
		Fail(c, http.StatusBadGateway, resp.Error)
		return
	}

	c.JSON(http.StatusOK, resp)
}
