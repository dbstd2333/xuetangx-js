const { HEARTBEAT_INTERVAL, HEARTBEAT_SPEED } = require('./config');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function makeHeartbeatEntry(opts) {
    return {
        i: HEARTBEAT_INTERVAL,
        et: opts.et,
        p: 'web',
        cp: opts.cp,
        fp: 0,
        tp: 0,
        sp: opts.speed || HEARTBEAT_SPEED,
        ts: opts.ts,
        u: opts.userId,
        c: opts.courseId,
        v: opts.leafId,
        classroomid: opts.classroomId,
        cc: '',
        d: opts.duration,
        pg: opts.pageGroup,
        sq: opts.seq,
        t: opts.videoType,
        lob: 'plat2',
        n: 'qn1-next.xuetangonline.com',
        skuid: opts.skuId,
    };
}

async function simulatePlayback(client, opts) {
    const {
        userId, courseId, leafId, classroomId,
        duration, videoType, skuId,
        onProgress,
    } = opts;

    const now = Date.now();
    const pageGroup = `${leafId}_${now}`;
    let seq = 1;
    const effectiveDuration = duration / HEARTBEAT_SPEED;

    // 1) play event
    const playEntry = makeHeartbeatEntry({
        et: 'play', cp: 0, ts: now, seq: seq++,
        userId, courseId, leafId, classroomId,
        duration, videoType, skuId, pageGroup,
    });
    await client.post('/video-log/heartbeat/', { heart_data: [playEntry] });

    // 2) heartbeat events every 5 simulated seconds
    let cp = 0;
    const step = HEARTBEAT_INTERVAL * HEARTBEAT_SPEED;
    const totalSteps = Math.ceil(duration / step);

    for (let i = 0; i < totalSteps; i++) {
        cp += step;
        if (cp > duration) cp = duration;

        const hbEntry = makeHeartbeatEntry({
            et: 'heartbeat', cp, ts: Date.now(), seq,
            userId, courseId, leafId, classroomId,
            duration, videoType, skuId, pageGroup,
            speed: HEARTBEAT_SPEED,
        });

        await client.post('/video-log/heartbeat/', { heart_data: [hbEntry] });

        if (onProgress) {
            onProgress(cp, duration);
        }

        // Throttle to avoid rate limit
        await sleep(5000);
    }

    // 3) videoend event
    const endEntry = makeHeartbeatEntry({
        et: 'videoend', cp: duration, ts: Date.now(), seq,
        userId, courseId, leafId, classroomId,
        duration, videoType, skuId, pageGroup,
    });
    await client.post('/video-log/heartbeat/', { heart_data: [endEntry] });
}

module.exports = { simulatePlayback };
