const BASE_URL = 'https://www.xuetangx.com';

const LEAF_TYPE = {
    VIDEO: 0,
    AUDIO: 1,
    IMAGE_TEXT: 3,
    DISCUSSION: 4,
    EXAM: 5,
    EXERCISE: 6,
};

const HEARTBEAT_INTERVAL = 15;
const HEARTBEAT_SPEED = 2;

const SKIP_LEAF_TYPES = new Set([
    LEAF_TYPE.EXAM,
    LEAF_TYPE.EXERCISE,
]);

const DEFAULT_HEADERS = {
    'content-type': 'application/json',
    'x-client': 'web',
    'xtbz': 'xt',
    'app-name': 'xtzx',
};

module.exports = {
    BASE_URL,
    LEAF_TYPE,
    HEARTBEAT_INTERVAL,
    HEARTBEAT_SPEED,
    SKIP_LEAF_TYPES,
    DEFAULT_HEADERS,
};
