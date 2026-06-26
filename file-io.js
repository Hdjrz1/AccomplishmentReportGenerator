const fs = require('fs');
const path = require('path');

const RETRIABLE_CODES = new Set(['EBUSY', 'EPERM', 'EACCES']);

function sleepSync(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        // busy-wait for sync generator context
    }
}

function isRetriableIoError(err) {
    return Boolean(err && RETRIABLE_CODES.has(err.code));
}

function withIoRetrySync(operation, options = {}) {
    const maxAttempts = options.maxAttempts ?? 8;
    const baseDelayMs = options.baseDelayMs ?? 125;
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return operation(attempt);
        } catch (err) {
            lastError = err;
            if (isRetriableIoError(err) && attempt < maxAttempts) {
                sleepSync(baseDelayMs * attempt);
                continue;
            }
            throw err;
        }
    }

    throw lastError;
}

function removeFileIfExists(filePath) {
    try {
        fs.unlinkSync(filePath);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            throw err;
        }
    }
}

function writeFileAtomicSync(targetPath, writeFn, options = {}) {
    const dir = path.dirname(targetPath);
    const baseName = path.basename(targetPath);
    const tmpPath = path.join(dir, `.arg-${baseName}.${process.pid}.${Date.now()}.tmp`);

    try {
        withIoRetrySync(() => {
            writeFn(tmpPath);
            removeFileIfExists(targetPath);
            fs.renameSync(tmpPath, targetPath);
        }, options);
    } catch (err) {
        removeFileIfExists(tmpPath);

        if (isRetriableIoError(err)) {
            throw new Error(
                `Cannot write "${baseName}" because the file is locked. Close it in Microsoft Word (or pause OneDrive sync) and try again.`
            );
        }

        throw err;
    }
}

function readFileBufferSync(filePath, options = {}) {
    return withIoRetrySync(() => fs.readFileSync(filePath), options);
}

module.exports = {
    isRetriableIoError,
    withIoRetrySync,
    writeFileAtomicSync,
    readFileBufferSync
};
