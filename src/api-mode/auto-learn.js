const { checkLogin } = require('./auth');
const { getCourseChapters, getCourseSchedule, getLeafInfo, updateChapterSchedule, flattenLeaves, getLeafTypeName, getVideoTypeParam } = require('./course');
const { simulatePlayback } = require('./video');
const { markImageTextDone } = require('./image-text');
const { processExercise } = require('./exercise');
const { processDiscussion } = require('./discussion');
const { LEAF_TYPE } = require('./config');

const SLEEP_BETWEEN_ITEMS = 0;

function log(msg) {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] ${msg}`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAutoLearn(client, sign, classroomId, options = {}) {
    const { skipAudio = false } = options;

    log('检查登录状态...');
    const user = await checkLogin(client);
    log(`已登录: userId=${user.userId}, 学号=${user.schoolNumber}`);

    log(`课程: sign=${sign}, classroomId=${classroomId}`);

    log('获取课程章节...');
    const courseData = await getCourseChapters(client, classroomId, sign);
    const allLeaves = flattenLeaves(courseData.course_chapter);

    log('获取课程进度...');
    const schedule = await getCourseSchedule(client, classroomId, sign);

    const totalLeaves = allLeaves.length;
    const completedLeaves = allLeaves.filter(l => schedule[l.id] === 1).length;
    log(`共 ${totalLeaves} 个叶子节点，已完成 ${completedLeaves}，剩余 ${totalLeaves - completedLeaves}`);

    const pendingLeaves = allLeaves.filter(leaf => {
        if (skipAudio && leaf.leaf_type === LEAF_TYPE.AUDIO) return false;
        if (schedule[leaf.id] === 1) return false;
        return true;
    });

    if (pendingLeaves.length === 0) {
        log('所有可处理的章节都已完成！');
        return;
    }

    log(`待处理 ${pendingLeaves.length} 个章节，开始自动学习...\n`);

    // 后台视频任务追踪
    const bgVideoTasks = [];

    for (let i = 0; i < pendingLeaves.length; i++) {
        const leaf = pendingLeaves[i];
        const typeName = getLeafTypeName(leaf.leaf_type);
        log(`[${typeName}] (${i + 1}/${pendingLeaves.length}) ${leaf.name} (id=${leaf.id})`);

        try {
            if (leaf.leaf_type === LEAF_TYPE.VIDEO || leaf.leaf_type === LEAF_TYPE.AUDIO) {
                // 视频/音频放到后台并发，不阻塞后续章节
                bgVideoTasks.push(
                    processVideoLeaf(client, leaf, user, sign, classroomId)
                        .catch(err => log(`  [后台] 视频错误: ${err.message}`))
                );
                log(`  已触发后台播放`);
            } else if (leaf.leaf_type === LEAF_TYPE.IMAGE_TEXT) {
                await processImageTextLeaf(client, leaf, sign, classroomId);
            } else if (leaf.leaf_type === LEAF_TYPE.EXERCISE || leaf.leaf_type === LEAF_TYPE.EXAM) {
                await processExerciseLeaf(client, leaf, sign, classroomId);
            } else if (leaf.leaf_type === LEAF_TYPE.DISCUSSION) {
                await processDiscussion(client, leaf.id, classroomId, sign);
            } else {
                await processGenericLeaf(client, leaf, sign, classroomId);
            }
        } catch (err) {
            log(`  错误: ${err.message}`);
        }

        if (i < pendingLeaves.length - 1) {
            if (SLEEP_BETWEEN_ITEMS > 0) {
                log(`  等待 ${SLEEP_BETWEEN_ITEMS / 1000}s...`);
                await sleep(SLEEP_BETWEEN_ITEMS);
            }
        }

        console.log('');
    }

    // 等待所有后台视频任务完成
    if (bgVideoTasks.length > 0) {
        log(`等待 ${bgVideoTasks.length} 个后台视频任务完成...`);
        await Promise.all(bgVideoTasks);
        log('所有视频任务已完成。');
    }

    log('最终进度检查...');
    const finalSchedule = await getCourseSchedule(client, classroomId, sign);
    const finalCompleted = allLeaves.filter(l => finalSchedule[l.id] === 1).length;
    log(`完成 ${finalCompleted}/${totalLeaves}`);
    log('自动学习结束！');
}

async function processVideoLeaf(client, leaf, user, sign, classroomId) {
    const leafInfo = await getLeafInfo(client, classroomId, leaf.id, sign);
    const media = leafInfo.content_info?.media;

    let duration = media?.duration || 0;

    // debug: 打印完整 media 信息
    log(`  media: ccid=${media?.ccid}, duration=${duration}, size=${media?.size}, type=${media?.type}`);

    if (duration <= 0 && media?.size > 0) {
        // 时长元数据缺失，从文件大小估算（约 1MB/s 码率）
        const estimated = Math.round(media.size / (1024 * 1024));
        log(`  时长为 0，从文件大小 ${Math.round(media.size / 1024 / 1024)}MB 估算约 ${estimated}s`);
        duration = estimated;
    }

    if (duration <= 0) {
        log(`  无法获取时长，尝试直接标记完成...`);
        const skuId = leafInfo.sku_id;
        try {
            const res = await updateChapterSchedule(client, leaf.id, Number(classroomId), skuId);
            const progress = res.leaf_schedule;
            log(`  标记结果: ${(progress * 100).toFixed(1)}%`);
        } catch (e) {
            log(`  标记失败: ${e.message}`);
        }
        return;
    }

    const videoType = getVideoTypeParam(leaf.leaf_type);
    const skuId = leafInfo.sku_id;

    log(`  时长: ${duration.toFixed(1)}s, 类型: ${videoType}`);

    // 带重试的播放模拟
    const MAX_RETRIES = 5;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await simulatePlayback(client, {
                userId: user.userId,
                courseId: leafInfo.course_id,
                leafId: leaf.id,
                classroomId: Number(classroomId),
                duration,
                videoType,
                skuId,
                onProgress: (cp, total) => {
                    const pct = ((cp / total) * 100).toFixed(0);
                    if (Number(pct) % 20 === 0) {
                        log(`  进度: ${pct}%`);
                    }
                },
            });
            break; // 成功，跳出重试循环
        } catch (e) {
            const isRateLimit = e.message && e.message.includes('429');
            if (attempt < MAX_RETRIES) {
                const waitSec = isRateLimit ? 45 : 10 * attempt;
                log(`  ⚠ 播放失败 (${e.message})，${waitSec}s 后重试 (${attempt}/${MAX_RETRIES})...`);
                await sleep(waitSec * 1000);
            } else {
                log(`  ✗ 播放失败，已达最大重试次数: ${e.message}`);
                throw e;
            }
        }
    }

    await sleep(1000);
    const updatedSchedule = await updateChapterSchedule(client, leaf.id, Number(classroomId), skuId);
    const progress = updatedSchedule.leaf_schedule;
    if (progress >= 1) {
        log(`  完成！进度: ${(progress * 100).toFixed(0)}%`);
    } else {
        log(`  进度: ${(progress * 100).toFixed(1)}% (可能需要重播)`);
    }
}

async function processImageTextLeaf(client, leaf, sign, classroomId) {
    const leafInfo = await getLeafInfo(client, classroomId, leaf.id, sign);
    const skuId = leafInfo.sku_id;
    await markImageTextDone(client, leaf.id, classroomId, skuId);
    log('  已标记完成');
}

async function processExerciseLeaf(client, leaf, sign, classroomId) {
    const leafInfo = await getLeafInfo(client, classroomId, leaf.id, sign);
    const exerciseId = leafInfo.content_info?.leaf_type_id;
    const skuId = leafInfo.sku_id;

    if (!exerciseId) {
        log(`  无法获取 exercise_id (leaf_type_id)，尝试直接标记...`);
        const res = await updateChapterSchedule(client, leaf.id, Number(classroomId), skuId);
        log(`  标记结果: ${(res.leaf_schedule * 100).toFixed(1)}%`);
        return;
    }

    const result = await processExercise(client, leaf.id, Number(classroomId), sign, exerciseId, skuId);
    if (result.total === 0) {
        log('  无题目数据，尝试直接标记...');
        const res = await updateChapterSchedule(client, leaf.id, Number(classroomId), skuId);
        log(`  标记结果: ${(res.leaf_schedule * 100).toFixed(1)}%`);
    } else {
        log(`  题目: ${result.total} 题, 提交: ${result.submitted}, 正确: ${result.correct || 0}, DS: ${result.dsUsed || 0}, 跳过: ${result.skipped}`);
    }
}

async function processGenericLeaf(client, leaf, sign, classroomId) {
    const leafInfo = await getLeafInfo(client, classroomId, leaf.id, sign);
    const skuId = leafInfo.sku_id;
    const res = await updateChapterSchedule(client, leaf.id, Number(classroomId), skuId);
    const progress = res.leaf_schedule;
    if (progress >= 1) {
        log(`  已标记完成！进度: ${(progress * 100).toFixed(0)}%`);
    } else {
        log(`  进度: ${(progress * 100).toFixed(1)}%`);
    }
}

module.exports = { runAutoLearn };
