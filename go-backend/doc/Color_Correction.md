# Color Correction API

## 接口信息

| 项目 | 说明 |
|------|------|
| 路径 | `https://api3.ququan.net/quality/api/quality_check` |
| 方法 | `POST` |
| Content-Type | `multipart/form-data` |

## 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `image` | file | 是 | 待校正的图片文件 |

## 成功响应（200）

拍摄环境校验通过，返回校正结果。

```json
{
    "brand": "Unknown",
    "device_info": "未知设备",
    "distance": 0.2927,
    "elapsed_time": 9.859187602996826,
    "original": "https://f3.ququan.net/temp/check/20260911_094920_unknown_device_orig.jpg",
    "passed": true,
    "results": [
        {
            "corrected": "https://f3.ququan.net/temp/check/20260911_094920_unknown_device_corr_0_Apple_iPhone17e_IMG_9921_1_jpg.jpg",
            "distance": 0.0928,
            "model_name": "Apple iPhone17e/IMG_9921_1.jpg"
        },
        {
            "corrected": "https://f3.ququan.net/temp/check/20260911_094920_unknown_device_corr_1_Huawei_Hera_BD00_120_1.jpg",
            "distance": 0.0942,
            "model_name": "Huawei Hera-BD00/120_1"
        },
        {
            "corrected": "https://f3.ququan.net/temp/check/20260911_094920_unknown_device_corr_2_Apple_iPhone17e_2026_08_25_18_.jpg",
            "distance": 0.1069,
            "model_name": "Apple iPhone17e/2026-08-25_18.37_12_IMG_9070_1.37_12_IMG_9070"
        }
    ],
    "threshold": 0.6
}
```

### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `brand` | string | 检测到的品牌，未知时为 `"Unknown"` |
| `device_info` | string | 设备信息描述 |
| `distance` | float | 原图与标准环境的距离值 |
| `elapsed_time` | float | 处理耗时（秒） |
| `original` | string | 原图 URL |
| `passed` | bool | 是否通过校验（`distance < threshold` 时为 `true`） |
| `results` | array | 校正结果列表（仅 `passed=true` 时返回） |
| `results[].corrected` | string | 校正后图片 URL |
| `results[].distance` | float | 校正后图片与标准环境的距离值 |
| `results[].model_name` | string | 校正所用的模型名称 |
| `threshold` | float | 校验阈值 |

## 失败响应（200）

拍摄环境不符合标准，校验未通过。

```json
{
    "brand": "Unknown",
    "distance": 0.7052,
    "error": "当前拍摄环境与标准环境不匹配（距离 0.7052 ≥ 阈值 0.600），请重新拍摄",
    "passed": false,
    "threshold": 0.6
}
```

### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `brand` | string | 检测到的品牌 |
| `distance` | float | 原图与标准环境的距离值 |
| `error` | string | 错误提示信息 |
| `passed` | bool | 校验结果，始终为 `false` |
| `threshold` | float | 校验阈值 |
