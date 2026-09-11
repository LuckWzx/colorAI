package service

import (
	"colorai-backend/model/response"
	"colorai-backend/repository"
)

// KnowledgeService 知识库业务接口
type KnowledgeService interface {
	GetColorIssues(keyword string) ([]response.QAItem, error)
	GetPhotoTips() ([]response.QAItem, error)
	GetShops(city string) ([]response.Shop, error)
	GetBrands(category string) ([]response.Brand, error)
}

type knowledgeService struct {
	knowledgeRepo repository.KnowledgeRepository
}

// NewKnowledgeService 创建 KnowledgeService 实例
func NewKnowledgeService(knowledgeRepo repository.KnowledgeRepository) KnowledgeService {
	return &knowledgeService{knowledgeRepo: knowledgeRepo}
}

func (s *knowledgeService) GetColorIssues(keyword string) ([]response.QAItem, error) {
	return s.knowledgeRepo.GetColorIssues(keyword)
}

func (s *knowledgeService) GetPhotoTips() ([]response.QAItem, error) {
	return s.knowledgeRepo.GetPhotoTips()
}

func (s *knowledgeService) GetShops(city string) ([]response.Shop, error) {
	return s.knowledgeRepo.GetShops(city)
}

func (s *knowledgeService) GetBrands(category string) ([]response.Brand, error) {
	return s.knowledgeRepo.GetBrands(category)
}
