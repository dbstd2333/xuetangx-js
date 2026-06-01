const { updateChapterSchedule, getLeafInfo } = require('./course');
const { withRetry } = require('./auth');

const DEFAULT_TEXT = '很有启发性的讨论，让我对这个问题有了更深入的思考。';

function logRetry(attempt, e, waitSec) {
    console.log(`  [retry] (${e.message})，${waitSec}s 后重试 (${attempt}/3)...`);
}

async function processDiscussion(client, leafId, classroomId, sign) {
    const leafInfo = await withRetry(
        () => getLeafInfo(client, classroomId, leafId, sign),
        { onRetry: logRetry }
    );
    const contentInfo = leafInfo?.content_info || {};
    const skuId = leafInfo.sku_id;
    const status = contentInfo.status;

    console.log('  [debug] status:', status, '| content_info keys:', Object.keys(contentInfo).join(','));

    // 先获取讨论单元信息（包含 topic_id 和 to_user）
    let topicId, toUser;

    try {
        const unitRes = await withRetry(
            () => client.get(
                `/api/v1/lms/forum/unit/discussion/?product_sign=${sign}&leaf_id=${leafId}&classroom_id=${classroomId}&topic_type=4&channel=xt`
            ),
            { onRetry: logRetry }
        );
        const unitData = unitRes.data;
        topicId = unitData?.id;
        toUser = unitData?.user_id || 0;
        console.log(`  [debug] unit/discussion: topicId=${topicId}, toUser=${toUser}`);
    } catch (e) {
        console.log(`  [debug] unit/discussion 获取失败: ${e.message}`);
    }

    // 也从 content_info 尝试提取
    if (!topicId) {
        topicId = contentInfo.topic_id
            || contentInfo.discussion?.topic_id
            || contentInfo.discussion_topic_id;
    }
    if (!toUser || toUser === 0) {
        toUser = contentInfo.to_user
            || contentInfo.discussion?.user_id
            || contentInfo.creator_id
            || 0;
    }

    if (!topicId) {
        console.log('  ⚠ 无法获取 topic_id，跳过评论');
    } else {
        const body = {
            to_user: toUser,
            topic_id: topicId,
            content: { text: DEFAULT_TEXT, upload_images: [] },
        };

        console.log(`  [debug] 发评论: topicId=${topicId}, toUser=${toUser}`);

        try {
            const res = await withRetry(
                () => client.post(
                    `/api/v1/lms/forum/comment/?classroom_id=${classroomId}&leaf_id=${leafId}`,
                    body
                ),
                { onRetry: logRetry }
            );
            console.log('  [debug] 评论响应:', JSON.stringify(res).slice(0, 300));

            if (res.success || res.data?.status === 0) {
                console.log('  ✓ 评论成功');
            } else {
                console.log('  ⚠ 响应非预期:', res.data?.message || JSON.stringify(res.data).slice(0, 200));
            }
        } catch (e) {
            console.log(`  ✗ 评论失败: ${e.message}`);
        }
    }

    // 更新进度
    const scheduleRes = await withRetry(
        () => updateChapterSchedule(client, leafId, Number(classroomId), skuId),
        { onRetry: logRetry }
    );
    const progress = scheduleRes.leaf_schedule;
    if (progress >= 1) {
        console.log(`  ✓ 进度: 100%`);
    } else {
        console.log(`  进度: ${(progress * 100).toFixed(0)}%`);
    }
    return { success: progress >= 1, progress };
}

module.exports = { processDiscussion };
