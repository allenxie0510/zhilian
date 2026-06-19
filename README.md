# 知链 (Zhilian) — AI驱动的个人知识图谱

## 项目结构

```
zhilian/
├── PRD.md                     # 产品需求文档
├── backend/                   # Python 后端 (FastAPI)
│   ├── main.py               # 应用入口
│   ├── models.py             # Pydantic 数据模型
│   ├── database.py           # SQLite 笔记存储
│   ├── graph_store.py        # 内存图存储 (JSON持久化)
│   ├── ai_service.py         # AI实体抽取 & 问答
│   ├── routes/
│   │   ├── notes.py          # 笔记 CRUD API
│   │   ├── graph.py          # 图谱查询 API
│   │   └── ai.py             # AI 抽取 & 问答 API
│   └── data/                 # 运行时数据 (自动创建)
├── frontend/                  # React 前端
│   ├── src/
│   │   ├── App.tsx           # 主布局
│   │   ├── components/
│   │   │   ├── GraphView.tsx  # Cytoscape.js 图谱渲染
│   │   │   ├── NoteEditor.tsx # 笔记编辑器
│   │   │   ├── Sidebar.tsx    # 笔记列表
│   │   │   ├── NodeDetail.tsx # 节点详情面板
│   │   │   ├── SearchBar.tsx  # 图谱搜索
│   │   │   └── AIAskPanel.tsx # AI 问答面板
│   │   ├── api/client.ts     # API 客户端
│   │   └── types/index.ts    # TypeScript 类型
│   └── ...
└── README.md
```

## 快速开始

### 启动后端

```bash
cd backend
pip install -r requirements.txt
python main.py
# API: http://localhost:8000
# 文档: http://localhost:8000/docs
```

### 启动前端

```bash
cd frontend
npm install
npm run dev
# 前端: http://localhost:5173
```

## 当前运行状态

- ✅ 后端: `http://localhost:8000` (含4条示例笔记，22个图谱节点)
- ✅ 前端: `http://localhost:5173`
- ✅ 前端通过 Vite proxy 自动转发 API 请求到后端

## MVP 功能完成度

| 模块 | 功能 | 状态 |
|------|------|------|
| 内容录入 | Markdown笔记录入 | ✅ |
| 内容录入 | 笔记列表/搜索 | ✅ |
| AI建图 | 启发式实体抽取 | ✅ |
| AI建图 | LLM实体抽取 | ✅ (配置后) |
| AI建图 | 关系识别 | ✅ |
| AI建图 | 自动图谱构建 | ✅ |
| 图谱可视化 | 力导向布局 | ✅ |
| 图谱可视化 | 缩放/拖拽 | ✅ |
| 图谱可视化 | 节点颜色分类 | ✅ |
| 图谱可视化 | 图例 | ✅ |
| 节点交互 | 点击查看详情 | ✅ |
| 节点交互 | 邻域节点关联 | ✅ |
| 搜索 | 图谱节点搜索 | ✅ |
| AI问答 | KG增强问答 | ✅ (配置LLM后) |

## LLM 集成

设置环境变量启用真实 LLM：

```bash
export ZHILIAN_LLM_BASE_URL="https://api.deepseek.com"
export ZHILIAN_LLM_API_KEY="your-api-key"
export ZHILIAN_LLM_MODEL="deepseek-chat"
```

未配置时使用内置的启发式规则（关键词+模式匹配）进行实体抽取。

## 技术栈

- **前端**: React 19 + TypeScript + Vite + Tailwind CSS + Cytoscape.js
- **后端**: FastAPI (Python) + SQLModel + Uvicorn
- **存储**: SQLite (笔记元数据) + 内存图 (JSON持久化)
- **AI**: 启发式抽取 + DeepSeek/Ollama LLM 可选集成
