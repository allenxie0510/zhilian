"""AI Service — entity extraction, relation recognition, and Q&A.

Uses a hybrid approach:
1. Local heuristic extraction (keyword + pattern based) — always available
2. Optional LLM integration (DeepSeek / Ollama) — when configured

Set environment variable ZHILIAN_LLM_BASE_URL to enable LLM mode.
"""

from __future__ import annotations

import json
import os
import re
from typing import Optional

import httpx

from models import AIEntity, AIExtractResponse, AIRelation, NodeType, RelationType

# ── Configuration ─────────────────────────────────────────

LLM_BASE_URL = os.environ.get("ZHILIAN_LLM_BASE_URL", "")
LLM_API_KEY = os.environ.get("ZHILIAN_LLM_API_KEY", "")
LLM_MODEL = os.environ.get("ZHILIAN_LLM_MODEL", "deepseek-chat")
USE_LLM = bool(LLM_BASE_URL)


# ── Extraction prompt ─────────────────────────────────────

EXTRACTION_SYSTEM_PROMPT = """你是一个知识图谱构建助手。从用户提供的文本中抽取核心实体和它们之间的关系。

实体类型定义：
- concept: 概念、术语、方法论、理论
- person: 人名、人物
- project: 项目、产品、工具名称
- topic: 主题、领域、学科
- note: 笔记引用（通常不需要抽取）

关系类型定义：
- belongs_to: A属于B（上下位关系，子类/子概念）
- depends_on: A依赖于B
- references: A引用了B
- similar_to: A与B相似
- derives_from: A派生自B

请严格按以下JSON格式输出（只输出JSON，不要其他文字）：
{
  "entities": [{"name": "实体名称", "type": "concept|person|project|topic"}],
  "relations": [{"source": "实体A名称", "target": "实体B名称", "type": "belongs_to|depends_on|references|similar_to|derives_from"}]
}

规则：
1. 只抽取有意义的实体，忽略虚词和泛指
2. 每个实体名称要简短精确（不超过20字）
3. 关系只在有明显关联的实体之间建立
4. 不要虚构实体或关系
5. 对中文文本，实体名称使用中文原文"""


# ── Local heuristic extraction (fallback) ─────────────────

# Common concept keywords in Chinese tech/product contexts
CONCEPT_PATTERNS: list[tuple[str, NodeType]] = [
    # Technical concepts
    (r"知识图谱", NodeType.concept),
    (r"知识管理", NodeType.concept),
    (r"人工智能|AI|机器学习|深度学习|NLP|自然语言处理", NodeType.concept),
    (r"大语言模型|LLM|大模型", NodeType.concept),
    (r"图数据库|Neo4j|图计算", NodeType.concept),
    (r"向量数据库|向量检索|RAG", NodeType.concept),
    (r"微服务|API|REST|GraphQL", NodeType.concept),
    (r"敏捷开发|Scrum|看板|DevOps", NodeType.concept),
    (r"设计模式|架构模式|MVC|MVVM", NodeType.concept),
    (r"用户画像|用户体验|UX|UI", NodeType.concept),
    (r"数据分析|数据挖掘|ETL", NodeType.concept),
    (r"云计算|容器化|Docker|Kubernetes|k8s", NodeType.concept),
    (r"持续集成|持续部署|CI/CD", NodeType.concept),
    (r"产品管理|项目管理|需求管理", NodeType.concept),
    (r"增长黑客|AARRR|转化率", NodeType.concept),
    # Projects / tools
    (r"React|Vue|Angular|Next\.js|Nuxt", NodeType.project),
    (r"FastAPI|Django|Flask|Spring", NodeType.project),
    (r"Python|Java|Go|Rust|TypeScript|JavaScript", NodeType.project),
    (r"Cytoscape|D3\.js|ECharts", NodeType.project),
    (r"Obsidian|Notion|Logseq|Roam", NodeType.project),
    (r"ChatGPT|Claude|GPT-[0-9]", NodeType.project),
    (r"GitHub|GitLab|Jira|Confluence", NodeType.project),
    (r"MySQL|PostgreSQL|MongoDB|Redis", NodeType.project),
    (r"TensorFlow|PyTorch|Keras|scikit-learn|NumPy|Pandas", NodeType.project),
    (r"神经网络|卷积神经网络|CNN|循环神经网络|RNN|Transformer|BERT|GPT", NodeType.concept),
    (r"自然语言处理|计算机视觉|强化学习|迁移学习|监督学习|无监督学习", NodeType.concept),
    (r"Node\.js|Deno|Bun|Webpack|Vite|ESBuild", NodeType.project),
    (r"GraphQL|RESTful|gRPC|消息队列|Kafka|RabbitMQ", NodeType.concept),
    # Topics
    (r"后端开发|前端开发|全栈开发", NodeType.topic),
    (r"系统设计|架构设计", NodeType.topic),
    (r"开源|开源社区", NodeType.topic),
    (r"性能优化|可扩展性", NodeType.topic),
    (r"安全|隐私|合规", NodeType.topic),
]

# Relation trigger words
RELATION_PATTERNS: list[tuple[str, RelationType]] = [
    (r"是一种|属于|是.*的一种|归类于|划分", RelationType.belongs_to),
    (r"依赖于|依赖|基于|需要.*支持|底层", RelationType.depends_on),
    (r"引用|参考|借鉴|参见|详见", RelationType.references),
    (r"类似于|类似|相似|如同|好比|相当于", RelationType.similar_to),
    (r"派生|起源于|来源于|演变|从.*发展", RelationType.derives_from),
]


def _heuristic_extract(text: str) -> AIExtractResponse:
    """Simple keyword + pattern based extraction for fallback."""
    entities: list[AIEntity] = []
    seen_names: set[str] = set()

    for pattern, ntype in CONCEPT_PATTERNS:
        for match in re.finditer(pattern, text):
            name = match.group(0).strip()
            if name not in seen_names:
                seen_names.add(name)
                entities.append(AIEntity(name=name, type=ntype))

    # Extract person names (Chinese: 2-3 chars, or English names)
    person_pattern = re.compile(
        r"(?:作者[：:]\s*|发布者[：:]\s*|演讲者[：:]\s*|创始人[：:]\s*|"
        r"作者是|by\s+)([A-Z][a-z]+(?:\s[A-Z][a-z]+)?|[\u4e00-\u9fff]{2,3})"
    )
    for match in person_pattern.finditer(text):
        name = match.group(1).strip()
        if name not in seen_names:
            seen_names.add(name)
            entities.append(AIEntity(name=name, type=NodeType.person))

    # Topic extraction: lines starting with # or ##
    topic_pattern = re.compile(r"^#{1,2}\s+(.+)$", re.MULTILINE)
    for match in topic_pattern.finditer(text):
        name = match.group(1).strip()
        if name not in seen_names:
            seen_names.add(name)
            entities.append(AIEntity(name=name, type=NodeType.topic))

    # Build relations based on proximity
    relations: list[AIRelation] = []
    entity_names = [e.name for e in entities]

    for sentence in re.split(r"[。；\n]", text):
        for rel_pattern, rel_type in RELATION_PATTERNS:
            rel_match = re.search(rel_pattern, sentence)
            if rel_match:
                # try to find 2 entities in this sentence
                found = [n for n in entity_names if n in sentence and n != rel_match.group(0)]
                if len(found) >= 2:
                    relations.append(AIRelation(
                        source=found[0], target=found[1], type=rel_type
                    ))
                break

    return AIExtractResponse(entities=entities, relations=relations)


# ── LLM-based extraction ──────────────────────────────────

async def _llm_extract(text: str) -> AIExtractResponse:
    """Use LLM API for high-quality extraction."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        headers = {"Content-Type": "application/json"}
        if LLM_API_KEY:
            headers["Authorization"] = f"Bearer {LLM_API_KEY}"

        payload = {
            "model": LLM_MODEL,
            "messages": [
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": f"请从以下文本中抽取实体和关系：\n\n{text[:8000]}"},
            ],
            "temperature": 0.3,
            "max_tokens": 2048,
        }

        resp = await client.post(f"{LLM_BASE_URL}/chat/completions", json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]

        # Parse JSON from LLM response (handle markdown code blocks)
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        parsed = json.loads(content.strip())
        return AIExtractResponse(**parsed)


# ── Public API ────────────────────────────────────────────

async def extract_entities_and_relations(text: str) -> AIExtractResponse:
    """Extract entities and relations from text. Uses LLM if configured, else heuristic."""
    if USE_LLM:
        try:
            return await _llm_extract(text)
        except Exception:
            # Fallback to heuristic on LLM failure
            pass
    return _heuristic_extract(text)


# ── AI Q&A (simple KG-enhanced) ───────────────────────────

QA_SYSTEM_PROMPT = """你是一个知识助手，基于用户的知识图谱回答问题。

你会收到两部分信息：
1. 知识图谱中的相关上下文（节点和关系）
2. 用户的原始笔记内容

请基于这些信息回答问题。如果信息不足，请诚实说明。
回答要简洁、有据可查。可以引用具体的知识来源。"""


async def answer_question(
    question: str,
    graph_context: str,
    note_contexts: list[str],
) -> str:
    """Answer a question using graph context and note contents."""
    if not USE_LLM:
        # Basic response without LLM
        if note_contexts:
            return f"根据知识库中的信息：\n\n{note_contexts[0][:500]}"
        return "目前知识库中暂未找到相关信息。尝试添加更多笔记来丰富知识图谱。"

    async with httpx.AsyncClient(timeout=60.0) as client:
        headers = {"Content-Type": "application/json"}
        if LLM_API_KEY:
            headers["Authorization"] = f"Bearer {LLM_API_KEY}"

        notes_text = "\n---\n".join(note_contexts[:3])

        payload = {
            "model": LLM_MODEL,
            "messages": [
                {"role": "system", "content": QA_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"知识图谱上下文：\n{graph_context}\n\n"
                        f"相关笔记内容：\n{notes_text}\n\n"
                        f"用户问题：{question}"
                    ),
                },
            ],
            "temperature": 0.5,
            "max_tokens": 1024,
        }

        resp = await client.post(f"{LLM_BASE_URL}/chat/completions", json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
