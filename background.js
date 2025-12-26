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

function buildMarkdownDataUrl(markdownContent) {
    return `data:text/markdown;charset=utf-8,${encodeURIComponent(markdownContent)}`;
}

function startDownload(url, filename) {
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
                downloadTargets.set(downloadId, filename);
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

        const safeFolderName = folderName || 'chat';
        console.log('[AI Chat Exporter][bg] downloadChatExport request', {
            folderName: safeFolderName,
            markdownFileName,
            markdownSize: markdownContent.length,
            imageCount: images.length
        });

        const downloadTasks = [];
        if (markdownContent) {
            const markdownUrl = buildMarkdownDataUrl(markdownContent);
            const markdownPath = `${safeFolderName}/${markdownFileName}`;
            downloadTasks.push(startDownload(markdownUrl, markdownPath));
        }

        images.forEach(image => {
            if (!image?.src || !image?.fileName) return;
            const safeImageFileName = sanitizeFileNameWithExtension(image.fileName, 'image', 'png');
            const imagePath = `${safeFolderName}/images/${safeImageFileName}`;
            downloadTasks.push(startDownload(image.src, imagePath));
        });

        Promise.all(downloadTasks)
            .then(results => {
                const failed = results.filter(result => !result.success);
                console.log('[AI Chat Exporter][bg] download results', {results});
                if (failed.length) {
                    sendResponse({
                        success: false,
                        error: `${failed.length} downloads failed`,
                        results
                    });
                    return;
                }
                sendResponse({success: true, results});
            })
            .catch(error => {
                sendResponse({success: false, error: error?.message || 'Download failed'});
            });
        return true;
    }
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    const target = downloadTargets.get(item.id);
    if (target) {
        console.log('[AI Chat Exporter][bg] onDeterminingFilename override', {id: item.id, target, suggested: item.filename});
        suggest({filename: target, conflictAction: 'uniquify'});
    } else {
        suggest();
    }
});

chrome.downloads.onChanged.addListener(delta => {
    if (downloadTargets.has(delta.id)) {
        console.log('[AI Chat Exporter][bg] download changed', delta);
    }
});
