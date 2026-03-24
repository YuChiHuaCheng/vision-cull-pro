# VisionCull Pro 📸

VisionCull Pro 是一款专为摄影师打造的**本地化、隐私安全的沉浸式 AI 废片筛选工具**。

它利用本地运行的深度学习视觉模型，能在**无需联网、不上传任何照片**的情况下，毫秒级扫描你的摄影作品，自动剔除**严重失焦、动态模糊**的废片，为你极大地节省选图时间。

## ✨ 核心特性 / Features
- 🛡️ **100% 本地运算**：基于 Node.js 与 Python 本地进程通信，绝对保护商业摄影隐私。
- 🧠 **AI 视觉引擎**：内置 Laplacian 方差检测算法，精准定位画面失焦与运动模糊。
- 🎛️ **三档动态阈值调控**：无论是手机随拍、单反直出还是苛刻的内棚商业摄影，皆可自定义过滤锐度下限。
- 🛸 **赛博极简美学 UI**：暗黑沉浸式工作台设计，支持原生系统级的文件夹拉起交互，提供流畅的客户端级体验。
- ⚡ **智能无损分发**：判定合格的照片将自动被安全拷贝至带时间戳的专属目录内（例如 `Selected_Good_2024...`），绝不破坏源文件。

## 🚀 快速启动 / Getting Started

### 1. 环境准备 (Prerequisites)
跑通此应用，您需要确保本地系统已经安装：
- **Node.js** (推荐 v18 或以上版本)
- **Python** (推荐 3.10 或 3.11 版本)

### 2. 初始化核心依赖 (Installation)
本项目采用了虚拟环境以防止污染您本地的 Python 环境。

```bash
# 克隆仓库
git clone https://github.com/YuChiHuaCheng/vision-cull-pro.git
cd vision-cull-pro

# 1. 安装前端 Node 依赖包
npm install

# 2. 安装 Python 算法级依赖
# 推荐使用 uv 或 pip 创建虚拟环境
python3 -m venv venv311
source venv311/bin/activate  # Mac/Linux 激活虚拟环境
# .\venv311\Scripts\activate # Windows 激活虚拟环境

pip install -r requirements.txt
```

### 3. 点火运行 (Run)
确保终端停留在项目根目录，并执行：
```bash
node server.js
```
随后，打开您的浏览器，访问 `http://localhost:3000` 即可步入您的 AI 选片控制台。

## 💡 使用说明 / Usage
1. 点击左侧配置面板的 **“浏览本地文件”**，在弹出的原生窗口中选择您的目标照片文件夹。
2. 拖动 **“清晰度阈值”** 滑块，选择符合您当前批次照片的严苛标准（推荐日常单反使用 300 左右的标准）。
3. 点击 **“开始执行扫描”**。
4. 在右侧的 **“处理日志终端”** 喝杯咖啡，静看 AI 引擎飞速运转。
5. 扫描结束后，去您选择的源文件夹同级目录下，寻找名为 `Selected_Good_时间戳` 的新文件夹，那里装着所有过滤后的成片。

## 🤝 贡献与反馈 / Contributing
本项目起初为解决独立摄影师的高强度机械劳动而生。欢迎提交 Pull Requests 加入更多 AI 维度（例如闭眼检测、表情评估等）！

如果有遇到任何 Bug，也欢迎开启 Issue 进行反馈。

## 📄 开源协议 / License
本项目采用 [MIT License](LICENSE) 协议开源。
