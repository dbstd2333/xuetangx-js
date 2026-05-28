const { updateChapterSchedule } = require('./course');
const { askDeepSeek } = require('./deepseek');

/**
 * 获取习题列表
 * URL: /api/v1/lms/exercise/get_exercise_list/{exercise_id}/{sku_id}/
 * 其中 exercise_id = content_info.leaf_type_id, sku_id = leafInfo.sku_id
 */
async function getExerciseList(client, exerciseId, skuId) {
    const res = await client.get(
        `/api/v1/lms/exercise/get_exercise_list/${exerciseId}/${skuId}/`
    );
    console.log(`  [debug] getExerciseList(${exerciseId}/${skuId}) status: ${res.status || res.data?.success}`);
    return res.data || {};
}

/**
 * 提交题目答案
 */
async function submitProblemAnswer(client, params) {
    const { leafId, classroomId, exerciseId, problemId, sign, answer } = params;
    return client.post('/api/v1/lms/exercise/problem_apply/', {
        leaf_id: leafId,
        classroom_id: Number(classroomId),
        exercise_id: exerciseId,
        problem_id: problemId,
        sign,
        answers: {},
        answer,
    });
}

/**
 * 处理习题/作业，优先用 DeepSeek 智能答题，失败则随机选择
 * @param {Object} client - HTTP client
 * @param {number} leafId - 叶子节点ID
 * @param {number} classroomId - 课堂ID
 * @param {string} sign - 课程sign
 * @param {number} exerciseId - 习题ID (来自 content_info.leaf_type_id)
 * @param {number} skuId - SKU ID
 */
async function processExercise(client, leafId, classroomId, sign, exerciseId, skuId) {
    const data = await getExerciseList(client, exerciseId, skuId);
    const problems = data.problems;

    if (!problems || problems.length === 0) {
        console.log('  [debug] 无题目数据');
        return { total: 0, submitted: 0, skipped: 0 };
    }

    let submitted = 0;
    let skipped = 0;
    let correct = 0;
    let dsUsed = 0;

    for (const problem of problems) {
        const problemId = problem.problem_id;
        const options = problem.content?.Options || [];
        const user = problem.user || {};
        const typeName = problem.content?.TypeText || problem.content?.Type || '未知';

        // 已显示答案（已提交过），跳过
        if (user.is_show_answer) {
            skipped++;
            console.log(`  - 题目${problem.index || problemId} [${typeName}] 已完成，跳过`);
            continue;
        }

        if (options.length === 0) {
            console.log(`  - 题目${problem.index || problemId} [${typeName}] 无选项，跳过`);
            skipped++;
            continue;
        }

        // 获取答案：优先 DeepSeek，失败 fallback 随机
        let answer = null;
        let answerSource = '';

        try {
            const dsAnswer = await askDeepSeek(problem);
            // 验证 DeepSeek 返回的选项是否都在合法范围
            const validKeys = new Set(options.map(o => o.key));
            const validDsAnswer = dsAnswer.filter(k => validKeys.has(k));
            if (validDsAnswer.length > 0) {
                answer = validDsAnswer;
                answerSource = 'DeepSeek';
                dsUsed++;
            }
        } catch (e) {
            console.log(`  [DeepSeek] 调用失败: ${e.message}`);
        }

        // Fallback: 随机选择
        if (!answer || answer.length === 0) {
            const randomIdx = Math.floor(Math.random() * options.length);
            answer = [options[randomIdx].key];
            answerSource = '随机';
        }

        try {
            const res = await submitProblemAnswer(client, {
                leafId: Number(leafId),
                classroomId,
                exerciseId,
                problemId,
                sign,
                answer,
            });

            const result = res.data;
            const isRight = result?.is_right || result?.is_correct;
            submitted++;

            if (isRight) {
                correct++;
                console.log(`  ✓ 题目${problem.index || problemId} [${typeName}] ${answerSource}选${answer.join(',')} 正确!`);
            } else {
                const correctAnswer = result?.answer || [];
                console.log(`  ✗ 题目${problem.index || problemId} [${typeName}] ${answerSource}选${answer.join(',')} 错误，正确答案: ${correctAnswer.join(',')}`);
            }
        } catch (e) {
            console.log(`  ✗ 题目${problem.index || problemId} 提交失败: ${e.message}`);
        }
    }

    // 更新进度
    try {
        const scheduleRes = await updateChapterSchedule(client, leafId, Number(classroomId), skuId);
        const progress = scheduleRes.leaf_schedule;
        console.log(`  进度: ${(progress * 100).toFixed(0)}%`);
    } catch (e) {
        console.log(`  进度更新失败: ${e.message}`);
    }

    return { total: problems.length, submitted, skipped, correct, dsUsed };
}

module.exports = { getExerciseList, submitProblemAnswer, processExercise };
