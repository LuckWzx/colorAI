package controller

import (
	"net/http"

	"colorai-backend/models"
	"colorai-backend/service"

	"github.com/gin-gonic/gin"
)

// SessionController 会话管理 HTTP 处理器
type SessionController struct {
	sessionSvc service.SessionService
}

// NewSessionController 创建 SessionController 实例
func NewSessionController(sessionSvc service.SessionService) *SessionController {
	return &SessionController{sessionSvc: sessionSvc}
}

func getUserID(c *gin.Context) string {
	return c.GetString("user_id")
}

// ListSessions 获取会话列表
// GET /api/sessions
func (h *SessionController) ListSessions(c *gin.Context) {
	userID := getUserID(c)

	list, err := h.sessionSvc.ListByUser(userID)
	if err != nil {
		HandleServiceError(c, err)
		return
	}

	OK(c, gin.H{"items": list, "total": len(list)})
}

// GetSession 获取会话详情
// GET /api/sessions/:id
func (h *SessionController) GetSession(c *gin.Context) {
	userID := getUserID(c)
	sessionID := c.Param("id")

	detail, err := h.sessionSvc.GetByID(userID, sessionID)
	if err != nil {
		HandleServiceError(c, err)
		return
	}

	OK(c, gin.H{"session": detail})
}

// CreateSession 创建新会话
// POST /api/sessions
func (h *SessionController) CreateSession(c *gin.Context) {
	userID := getUserID(c)

	session, err := h.sessionSvc.Create(userID)
	if err != nil {
		HandleServiceError(c, err)
		return
	}

	Created(c, gin.H{"session": session})
}

// SaveSession 保存会话
// PUT /api/sessions/:id
func (h *SessionController) SaveSession(c *gin.Context) {
	userID := getUserID(c)
	sessionID := c.Param("id")

	var req models.SaveSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, http.StatusBadRequest, "Invalid request body")
		return
	}

	session, err := h.sessionSvc.Save(userID, sessionID, req)
	if err != nil {
		HandleServiceError(c, err)
		return
	}

	OK(c, gin.H{"session": session})
}

// DeleteSession 删除会话
// DELETE /api/sessions/:id
func (h *SessionController) DeleteSession(c *gin.Context) {
	userID := getUserID(c)
	sessionID := c.Param("id")

	if err := h.sessionSvc.Delete(userID, sessionID); err != nil {
		HandleServiceError(c, err)
		return
	}

	OK(c, gin.H{})
}
