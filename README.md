# 🎓 学堂在线 (XuetangX) 学习辅助工具

这是一个为 [学堂在线](https://www.xuetangx.com/) 平台设计的学习效率工具，支持 API 模式和浏览器脚本两种使用方式，帮助更高效地完成在线课程学习。

---

## 🌟 两种模式

### 🔌 API 模式（推荐）

基于 Node.js 的命令行工具，直接调用学堂在线 API 完成学习任务。支持视频、图文、习题（DeepSeek AI 答题）、讨论等所有章节类型的自动处理。

**特点：**
- 后台运行，不占用浏览器
- 视频/音频并发处理，效率更高
- 支持 DeepSeek API 智能答题（需配置 `DEEPSEEK_API_KEY`）
- 断点续学，自动跳过已完成章节

### 🖥️ 浏览器脚本模式

Tampermonkey（油猴）脚本，在浏览器中运行。

**特点：**
- 浮动操作面板，可视化控制
- 智能识别未完成章节
- 自动跳转章节刷新学习进度

---

## 📥 安装与使用

### API 模式

```bash
# 1. 获取登录凭证
node src/api-mode/interactive.js    # 交互式扫码登录

# 2. 开始学习
node src/api-mode/index.js --course-url "https://www.xuetangx.com/learn/..."

# 可选参数
#   --skip-audio    跳过音频章节
```

**环境变量：**

| 变量 | 说明 |
|------|------|
| `SESSIONID` | 登录 sessionid |
| `CSRFTOKEN` | 登录 csrftoken |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（可选，用于 AI 答题） |

### 浏览器脚本

1. 安装 **脚本猫 (ScriptCat)** 扩展：[https://docs.scriptcat.org/](https://docs.scriptcat.org/)
2. **[点击安装脚本](https://raw.githubusercontent.com/dbstd2333/xuetangx-js/main/dist/xuetangx-autolearn.user.js)**
3. 打开任意学堂在线课程页面，右侧会出现浮动面板
4. 选择起始章节，点击启动

---

## 📋 支持的章节类型

| 类型 | 处理方式 |
|------|---------|
| 📹 视频 | 后台并发心跳模拟播放 |
| 🎵 音频 | 同视频处理 |
| 📖 图文 | 调用阅读完成接口 |
| 📝 习题/作业 | DeepSeek AI 智能答题（fallback 随机选择） |
| 💬 讨论 | 自动获取话题并发表评论 |

---

## ⚠️ 注意事项

- API 模式需要有效的登录凭证，可通过 `interactive.js` 扫码获取
- 仅用于个人学习辅助，请遵守平台使用规范
- 习题处理建议配置 DeepSeek API 以获得更好的正确率

---

## 📄 许可证

本项目采用 **自定义开源许可证**

- ✅ 允许 clone、fork、个人学习和研究使用
- ❌ **禁止商业用途**

详情参见 [LICENSE](LICENSE)

---
