/**
 * @Author Ye bv
 * @Time 2024/2/8 15:02
 * @Description
 */
// 当插件安装或更新时触发
chrome.runtime.onInstalled.addListener(function() {
    console.log("ChatGPT Exporter 插件已安装或更新");
});

const downloadTargets = new Map();
const pendingExports = new Map();

const IMAGE_MIME_EXTENSION_MAP = {
    'image/png': 'png',
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
    'image/avif': 'avif'
};

function normalizeImageExtension(extension) {
    if (!extension) return '';
    const cleaned = extension.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleaned === 'jpe' || cleaned === 'jfif' || cleaned === 'pjpeg' || cleaned === 'pjpg') return 'jpeg';
    if (cleaned === 'svgxml') return 'svg';
    if (cleaned === 'xicon') return 'ico';
    return cleaned;
}

function getExtensionFromFilename(filename) {
    if (!filename) return '';
    const base = filename.split(/[\\/]/).pop() || '';
    const match = base.match(/\.([a-zA-Z0-9]+)$/);
    return match ? normalizeImageExtension(match[1]) : '';
}

function mimeToExtension(contentType) {
    if (!contentType) return '';
    const mime = contentType.split(';')[0].trim().toLowerCase();
    return IMAGE_MIME_EXTENSION_MAP[mime] || '';
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceImageExtension(markdownContent, baseName, extension) {
    if (!markdownContent || !baseName || !extension) return markdownContent;
    const escapedBase = escapeRegExp(baseName);
    const regex = new RegExp(`(images/${escapedBase})\\.[a-zA-Z0-9]+`, 'g');
    return markdownContent.replace(regex, `$1.${extension}`);
}

function applyResolvedImageExtensions(markdownContent, resolvedImages) {
    let updated = markdownContent;
    resolvedImages.forEach((extension, baseName) => {
        updated = replaceImageExtension(updated, baseName, extension);
    });
    return updated;
}

function createExportId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function resolveImageExtensionForDownload(item, fallbackExt) {
    const extFromSuggested = getExtensionFromFilename(item?.filename);
    const extFromMime = mimeToExtension(item?.mime);
    const candidate = extFromSuggested || extFromMime || fallbackExt || '';
    const normalized = normalizeImageExtension(candidate);
    return normalized || fallbackExt || 'png';
}

function recordResolvedImage(exportId, baseName, extension, source) {
    const pending = pendingExports.get(exportId);
    if (!pending || !baseName || !extension) return;
    if (pending.resolvedImages.has(baseName)) return;
    pending.resolvedImages.set(baseName, extension);
    console.log('[AI Chat Exporter][bg] image extension resolved', {
        exportId,
        baseName,
        extension,
        source,
        resolved: pending.resolvedImages.size,
        expected: pending.expectedImageCount
    });
    if (pending.resolvedImages.size >= pending.expectedImageCount) {
        finalizeMarkdownDownload(exportId, 'all-resolved');
    }
}

function finalizeMarkdownDownload(exportId, reason) {
    const pending = pendingExports.get(exportId);
    if (!pending || pending.markdownQueued) return;
    pending.markdownQueued = true;
    if (pending.timerId) clearTimeout(pending.timerId);
    if (!pending.markdownContent) {
        console.log('[AI Chat Exporter][bg] markdown download skipped (empty content)', {exportId, reason});
        pendingExports.delete(exportId);
        return;
    }
    const updatedMarkdown = applyResolvedImageExtensions(pending.markdownContent, pending.resolvedImages);
    const markdownUrl = buildMarkdownDataUrl(updatedMarkdown);
    const markdownPath = `${pending.folderName}/${pending.markdownFileName}`;
    console.log('[AI Chat Exporter][bg] markdown download queued', {
        exportId,
        reason,
        resolved: pending.resolvedImages.size,
        expected: pending.expectedImageCount
    });
    startDownload(markdownUrl, markdownPath, {type: 'markdown', exportId});
    pendingExports.delete(exportId);
}

function buildMarkdownDataUrl(markdownContent) {
    return `data:text/markdown;charset=utf-8,${encodeURIComponent(markdownContent)}`;
}

function startDownload(url, filename, meta = {}) {
    return new Promise(resolve => {
        console.log('[AI Chat Exporter][bg] start download', {url, filename});
        chrome.downloads.download(
            {url, filename, conflictAction: 'uniquify', saveAs: false},
            downloadId => {
                if (chrome.runtime.lastError || !downloadId) {
                    console.error('[AI Chat Exporter][bg] download failed', {url, filename, error: chrome.runtime.lastError?.message});
                    resolve({
                        success: false,
                        url,
                        filename,
                        error: chrome.runtime.lastError?.message || 'Download failed'
                    });
                    return;
                }
                console.log('[AI Chat Exporter][bg] download started', {downloadId, filename});
                downloadTargets.set(downloadId, {target: filename, ...meta});
                resolve({success: true, url, filename, downloadId});
            }
        );
    });
}

function sanitizePathPart(part) {
    if (!part) return 'chat';
    return part
        .replace(/[\\/:*?"<>|]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 80) || 'chat';
}

function sanitizeFileNameWithExtension(name, defaultBase, defaultExt) {
    const safeExt = sanitizePathPart(defaultExt || 'md');
    if (!name) {
        return `${sanitizePathPart(defaultBase || 'chat')}.${safeExt}`;
    }
    const trimmed = name.trim();
    const lastDot = trimmed.lastIndexOf('.');
    let base = trimmed;
    let ext = safeExt;
    if (lastDot > 0) {
        base = trimmed.slice(0, lastDot);
        const extCandidate = trimmed.slice(lastDot + 1);
        if (extCandidate) {
            ext = sanitizePathPart(extCandidate);
        }
    }
    base = sanitizePathPart(base || defaultBase || 'chat');
    const resolvedExt = ext || safeExt;
    return `${base}.${resolvedExt}`;
}

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === "exportChatHistory") {
        // 在这里添加导出聊天记录的逻辑
        console.log("接收到导出聊天记录的请求");

        // 这里可以向内容脚本发送消息，执行相应的操作
        // 例如：sendResponse({ success: true });
    }

    if (message.action === "downloadChatExport") {
        const payload = message.payload || {};
        const folderName = sanitizePathPart(payload.folderName || 'chat');
        const markdownFileName = sanitizeFileNameWithExtension(payload.markdownFileName, folderName || 'chat', 'md');
        const markdownContent = payload.markdownContent || '';
        const images = Array.isArray(payload.images) ? payload.images : [];
        const imageEntries = images.filter(image => image?.fileName);

        const safeFolderName = folderName || 'chat';
        const exportId = createExportId();
        console.log('[AI Chat Exporter][bg] downloadChatExport request', {
            exportId,
            folderName: safeFolderName,
            markdownFileName,
            markdownSize: markdownContent.length,
            imageCount: images.length
        });

        const downloadTasks = [];
        const pendingExport = {
            id: exportId,
            folderName: safeFolderName,
            markdownFileName,
            markdownContent,
            expectedImageCount: imageEntries.length,
            resolvedImages: new Map(),
            markdownQueued: false,
            timerId: null
        };

        if (imageEntries.length) {
            pendingExports.set(exportId, pendingExport);
        }

        if (!imageEntries.length && markdownContent) {
            const markdownUrl = buildMarkdownDataUrl(markdownContent);
            const markdownPath = `${safeFolderName}/${markdownFileName}`;
            downloadTasks.push(startDownload(markdownUrl, markdownPath, {type: 'markdown', exportId}));
        }

        imageEntries.forEach((image, index) => {
            const safeImageFileName = sanitizeFileNameWithExtension(
                image.fileName,
                `image-${String(index + 1).padStart(2, '0')}`,
                'png'
            );
            const baseName = safeImageFileName.replace(/\.[^.]+$/, '');
            const fallbackExt = getExtensionFromFilename(safeImageFileName) || 'png';
            if (!image?.src) {
                recordResolvedImage(exportId, baseName, fallbackExt, 'missing-src');
                console.log('[AI Chat Exporter][bg] image missing src, fallback extension', {
                    exportId,
                    baseName,
                    fallbackExt
                });
                return;
            }
            const imagePath = `${safeFolderName}/images/${safeImageFileName}`;
            downloadTasks.push(
                startDownload(image.src, imagePath, {
                    type: 'image',
                    exportId,
                    baseName,
                    fallbackExt,
                    folderName: safeFolderName
                }).then(result => {
                    if (!result.success) {
                        recordResolvedImage(exportId, baseName, fallbackExt, 'download-failed');
                        console.log('[AI Chat Exporter][bg] image download failed, fallback extension', {
                            exportId,
                            baseName,
                            fallbackExt,
                            error: result.error
                        });
                    }
                    return result;
                })
            );
        });

        if (imageEntries.length) {
            pendingExport.timerId = setTimeout(() => {
                finalizeMarkdownDownload(exportId, 'timeout');
            }, 12000);
        }

        Promise.all(downloadTasks)
            .then(results => {
                const failed = results.filter(result => !result.success);
                console.log('[AI Chat Exporter][bg] download start results', {results});
                if (failed.length) {
                    sendResponse({
                        success: false,
                        error: `${failed.length} downloads failed to start`,
                        results
                    });
                    return;
                }
                sendResponse({success: true, results, exportId, pendingMarkdown: imageEntries.length > 0});
            })
            .catch(error => {
                sendResponse({success: false, error: error?.message || 'Download failed'});
            });
        return true;
    }
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    const meta = downloadTargets.get(item.id);
    if (meta) {
        if (meta.type === 'image') {
            const finalExt = resolveImageExtensionForDownload(item, meta.fallbackExt);
            const finalFileName = sanitizeFileNameWithExtension(
                `${meta.baseName}.${finalExt}`,
                meta.baseName,
                finalExt
            );
            const baseDir = meta.target.split('/').slice(0, -1).join('/');
            const finalPath = `${baseDir}/${finalFileName}`;
            console.log('[AI Chat Exporter][bg] onDeterminingFilename override', {
                id: item.id,
                exportId: meta.exportId,
                baseName: meta.baseName,
                fallbackExt: meta.fallbackExt,
                finalExt,
                suggested: item.filename,
                mime: item.mime,
                finalPath
            });
            suggest({filename: finalPath, conflictAction: 'uniquify'});
            recordResolvedImage(meta.exportId, meta.baseName, finalExt, 'onDeterminingFilename');
            return;
        }
        console.log('[AI Chat Exporter][bg] onDeterminingFilename override', {
            id: item.id,
            target: meta.target,
            suggested: item.filename
        });
        suggest({filename: meta.target, conflictAction: 'uniquify'});
    } else {
        suggest();
    }
});

chrome.downloads.onChanged.addListener(delta => {
    if (downloadTargets.has(delta.id)) {
        console.log('[AI Chat Exporter][bg] download changed', delta);
    }
});
