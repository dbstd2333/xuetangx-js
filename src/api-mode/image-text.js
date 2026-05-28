async function markImageTextDone(client, leafId, classroomId, skuId) {
    // 图文课专用标记完成 API (GET 请求)
    const res = await client.get(
        `/api/v1/lms/learn/user_article_finish/${leafId}/?cid=${classroomId}&sid=${skuId}`
    );
    return res;
}

module.exports = { markImageTextDone };
