/**
 * DeepSeek API 客户端 - 用于智能答题
 * API 兼容 OpenAI 格式: https://api.deepseek.com/v1
 */

const API_KEY = process.env.DEEPSEEK_API_KEY;
const BASE_URL = 'https://api.deepseek.com/v1';
const MODEL = 'deepseek-chat';

function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
        .replace(/&#?\w+;/g, '').trim();
}

/**
 * 构建发给 DeepSeek 的题目 prompt
 */
function buildPrompt(problem) {
    const content = problem.content || {};
    const typeText = content.TypeText || (content.Type === 'SingleChoice' ? '单选题' : '多选题');
    const body = stripHtml(content.Body);
    const options = (content.Options || []).map(o => `${o.key}. ${stripHtml(o.value)}`).join('\n');

    return `你是一个大学课程答题助手。请认真思考以下${typeText}，只输出正确答案的选项字母。

题目：${body}

选项：
${options}

${content.Type === 'MultipleChoice' ? '注意：这是多选题，可能有多个正确答案。请输出所有正确选项的字母，用逗号分隔，例如：A,C,D' : '请只输出一个正确的选项字母，例如：A'}
只输出选项字母，不要输出任何解释、标点或其他文字。`;
}

/**
 * 调用 DeepSeek API 获取答案
 * @returns {string[]} 答案选项数组，如 ['A'] 或 ['A', 'C']
 */
async function askDeepSeek(problem) {
    if (!API_KEY) {
        throw new Error('未设置 DEEPSEEK_API_KEY 环境变量');
    }

    const prompt = buildPrompt(problem);

    const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [
                { role: 'user', content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 50,
        }),
        signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`DeepSeek API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = await res.json();
    const answer = json.choices?.[0]?.message?.content?.trim() || '';

    // 解析回答：提取字母
    const letters = answer.match(/[A-G]/gi);
    if (!letters || letters.length === 0) {
        console.log(`  [DeepSeek] 无法解析回答: "${answer}"`);
        return [];
    }

    // 去重并转大写
    const result = [...new Set(letters.map(l => l.toUpperCase()))];
    console.log(`  [DeepSeek] 回答: "${answer}" → ${JSON.stringify(result)}`);
    return result;
}

module.exports = { askDeepSeek, stripHtml };
