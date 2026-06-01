const { withRetry } = require('./auth');

function logRetry(attempt, e, waitSec) {
    console.log(`  [retry] (${e.message})，${waitSec}s 后重试 (${attempt}/3)...`);
}

async function markImageTextDone(client, leafId, classroomId, skuId) {
    // 图文课专用标记完成 API (GET 请求)
    return withRetry(
        () => client.get(
            `/api/v1/lms/learn/user_article_finish/${leafId}/?cid=${classroomId}&sid=${skuId}`
        ),
        { onRetry: logRetry }
    );
}

module.exports = { markImageTextDone };
