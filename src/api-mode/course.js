const { LEAF_TYPE, SKIP_LEAF_TYPES } = require('./config');

function parseCourseUrl(url) {
    const pattern = /\/learn\/(?:space\/)?([^/]+)\/([^/]+)\/(\d+)/;
    const m = url.match(pattern);
    if (!m) {
        throw new Error(`无法解析课程 URL: ${url}\n格式示例: https://www.xuetangx.com/learn/{sign}/{sign}/{classroom_id}`);
    }
    return {
        sign: m[1],
        classroomId: m[3],
    };
}

async function getCourseInfo(client, classroomId, sign) {
    const res = await client.get(`/api/v1/lms/learn/product/info?cid=${classroomId}&sign=${sign}`);
    return res.data;
}

async function getCourseChapters(client, classroomId, sign) {
    const res = await client.get(`/api/v1/lms/learn/course/chapter?cid=${classroomId}&sign=${sign}`);
    return res.data;
}

async function getCourseSchedule(client, classroomId, sign) {
    const res = await client.get(`/api/v1/lms/learn/course/schedule?cid=${classroomId}&sign=${sign}`);
    return res.data.leaf_schedules;
}

async function getLeafInfo(client, classroomId, leafId, sign) {
    const res = await client.get(`/api/v1/lms/learn/leaf_info/${classroomId}/${leafId}/?sign=${sign}`);
    return res.data;
}

async function updateChapterSchedule(client, leafId, classroomId, skuId) {
    const res = await client.post('/api/v1/lms/learn/chapter/schedule', {
        leaf_id: leafId,
        classroom_id: classroomId,
        sku_id: skuId,
    });
    return res.data;
}

function flattenLeaves(courseChapters) {
    const leaves = [];
    for (const chapter of courseChapters) {
        for (const section of chapter.section_leaf_list || []) {
            for (const leaf of section.leaf_list || []) {
                leaves.push({
                    ...leaf,
                    chapterName: chapter.chapter_name,
                    sectionName: section.section_name,
                });
            }
        }
    }
    return leaves;
}

function getLeafTypeName(type) {
    const names = {
        [LEAF_TYPE.VIDEO]: '视频',
        [LEAF_TYPE.AUDIO]: '音频',
        [LEAF_TYPE.IMAGE_TEXT]: '图文',
        [LEAF_TYPE.DISCUSSION]: '讨论',
        [LEAF_TYPE.EXAM]: '考试',
        [LEAF_TYPE.EXERCISE]: '习题',
    };
    return names[type] || '未知';
}

function getVideoTypeParam(leafType) {
    if (leafType === LEAF_TYPE.AUDIO) return 'video_audio';
    return 'video';
}

module.exports = {
    parseCourseUrl,
    getCourseInfo,
    getCourseChapters,
    getCourseSchedule,
    getLeafInfo,
    updateChapterSchedule,
    flattenLeaves,
    getLeafTypeName,
    getVideoTypeParam,
};
