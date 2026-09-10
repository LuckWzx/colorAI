package service

import (
	"colorai-backend/models"
	"colorai-backend/repository"
)

// KnowledgeService 知识库业务接口
type KnowledgeService interface {
	GetColorIssues(keyword string) ([]models.QAItem, error)
	GetPhotoTips() ([]models.QAItem, error)
	GetShops(city string) ([]models.Shop, error)
	GetBrands(category string) ([]models.Brand, error)
}

type knowledgeService struct {
	knowledgeRepo repository.KnowledgeRepository
}

// NewKnowledgeService 创建 KnowledgeService 实例
func NewKnowledgeService(knowledgeRepo repository.KnowledgeRepository) KnowledgeService {
	return &knowledgeService{knowledgeRepo: knowledgeRepo}
}

func (s *knowledgeService) GetColorIssues(keyword string) ([]models.QAItem, error) {
	return s.knowledgeRepo.GetColorIssues(keyword)
}

func (s *knowledgeService) GetPhotoTips() ([]models.QAItem, error) {
	return s.knowledgeRepo.GetPhotoTips()
}

func (s *knowledgeService) GetShops(city string) ([]models.Shop, error) {
	return s.knowledgeRepo.GetShops(city)
}

func (s *knowledgeService) GetBrands(category string) ([]models.Brand, error) {
	return s.knowledgeRepo.GetBrands(category)
}
