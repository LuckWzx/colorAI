package service

import (
	"colorai-backend/model/entity"
	"colorai-backend/repository"
)

// KnowledgeService 知识库业务接口
type KnowledgeService interface {
	GetColorIssues(keyword string) ([]entity.QAItem, error)
	GetPhotoTips() ([]entity.QAItem, error)
	GetShops(city string) ([]entity.Shop, error)
	GetBrands(category string) ([]entity.Brand, error)
}

type knowledgeService struct {
	knowledgeRepo repository.KnowledgeRepository
}

// NewKnowledgeService 创建 KnowledgeService 实例
func NewKnowledgeService(knowledgeRepo repository.KnowledgeRepository) KnowledgeService {
	return &knowledgeService{knowledgeRepo: knowledgeRepo}
}

func (s *knowledgeService) GetColorIssues(keyword string) ([]entity.QAItem, error) {
	return s.knowledgeRepo.GetColorIssues(keyword)
}

func (s *knowledgeService) GetPhotoTips() ([]entity.QAItem, error) {
	return s.knowledgeRepo.GetPhotoTips()
}

func (s *knowledgeService) GetShops(city string) ([]entity.Shop, error) {
	return s.knowledgeRepo.GetShops(city)
}

func (s *knowledgeService) GetBrands(category string) ([]entity.Brand, error) {
	return s.knowledgeRepo.GetBrands(category)
}
