package response

// ColorCorrectionResponse 校色API响应结构
type ColorCorrectionResponse struct {
	Brand       string  `json:"brand"`
	DeviceInfo  string  `json:"device_info"`
	Distance    float64 `json:"distance"`
	ElapsedTime float64 `json:"elapsed_time"`
	Original    string  `json:"original"`
	Passed      bool    `json:"passed"`
	Results     []struct {
		Corrected string  `json:"corrected"`
		Distance  float64 `json:"distance"`
		ModelName string  `json:"model_name"`
	} `json:"results"`
	Threshold float64 `json:"threshold"`
	Error     string  `json:"error,omitempty"`
}
