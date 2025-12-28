/**
 * @Author Ye bv
 * @Time 2024/2/8 15:02
 * @Description
 */

// 全局变量，用于跟踪按钮显示状态
let shouldShowExportButton = true;
let isGrok = false;
let isGemini = false;
let isChatGPT = false;
// 监听来自 popup.js 的消息，实现按下按钮后导出或复制聊天记录
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "exportChatAsMarkdown") {
        exportChatAsMarkdown();
    }
    if (request.action === "copyChatAsMarkdown") {
        copyChatAsMarkdown();
    }
    if (request.action === "toggleExportButton") {
        shouldShowExportButton = request.show;
        toggleExportButtonVisibility();
        sendResponse({success: true});
    }
    // 新增：查询当前按钮状态
    if (request.action === "getButtonStatus") {
        sendResponse({show: shouldShowExportButton});
    }
    return true; // 保持消息通道开放，以便异步响应
});

// 在页面加载完成后执行
window.onload = () => {
    // 默认创建按钮
    createExportButton();

    // 定时检查并重新插入按钮（如果应该显示）
    setInterval(() => {
        if (shouldShowExportButton && !document.getElementById('export-chat')) {
            createExportButton();
        } else if (!shouldShowExportButton && document.getElementById('export-chat')) {
            document.getElementById('export-chat').remove();
        }
    }, 1000); // 每秒检查一次
};

// 切换导出按钮的可见性
function toggleExportButtonVisibility() {
    const existingButton = document.getElementById('export-chat');

    if (shouldShowExportButton) {
        // 如果应该显示按钮但不存在，则创建它
        if (!existingButton) {
            createExportButton();
        }
    } else {
        // 如果不应该显示按钮但存在，则移除它
        if (existingButton) {
            existingButton.remove();
        }
    }
}

// 获取对话内容的元素
function getConversationElements() {
    const currentUrl = window.location.href;
    if (currentUrl.includes("openai.com") || currentUrl.includes("chatgpt.com")) {
        // ChatGPT 的对话选择器 - Select all message containers
        isChatGPT = true;
        return document.querySelectorAll('div[data-message-id]');
    } else if (currentUrl.includes("grok.com")) {
        // Grok 的对话选择器：选择所有消息泡泡 (Keep as is, verify if Grok changed)
        isGrok = true;
        return document.querySelectorAll('div.message-bubble');
    } else if (currentUrl.includes("gemini.google.com")) {
        // Gemini 的对话选择器：选择所有消息容器 —— infinite-scroller 下的第一个div
        isGemini = true;
        result = [];
        // 取出所有的 user-query-content 和 model-response
        const userQueries = document.querySelectorAll('user-query-content');
        const modelResponses = document.querySelectorAll('model-response');
        // 按照顺序将 user-query-content 和 model-response 组合成一对
        for (let i = 0; i < userQueries.length; i++) {
            if (i < modelResponses.length) {
                result.push(userQueries[i]);
                result.push(modelResponses[i]);
            } else {
                result.push(userQueries[i]);
            }
        }
        return result;
    }
    return [];
}

// 复制聊天记录为 Markdown 格式
function copyChatAsMarkdown() {
    let markdownContent = "";
    let allElements = getConversationElements();

    for (let i = 0; i < allElements.length; i += 2) {
        if (!allElements[i + 1]) break; // 防止越界
        let userHtml = allElements[i].innerHTML.trim();
        let answerHtml = allElements[i + 1].innerHTML.trim();

        userHtml = htmlToMarkdown(userHtml);
        answerHtml = htmlToMarkdown(answerHtml);

        markdownContent += `\n# 用户问题\n${userHtml}\n# 回答\n${answerHtml}`;
    }

    markdownContent = markdownContent.replace(/&amp;/g, '&');
    if (!markdownContent) {
        console.log("未找到对话内容");
        return;
    }

    // 检查是否已经存在模态框
    if (document.getElementById('markdown-modal')) return;

    // 创建模态背景
    const modal = document.createElement('div');
    modal.id = 'markdown-modal';
    Object.assign(modal.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '1000'
    });

    // 创建模态内容容器
    const modalContent = document.createElement('div');
    Object.assign(modalContent.style, {
        backgroundColor: '#fff',
        color: '#000',
        padding: '20px',
        borderRadius: '8px',
        width: '50%',
        height: '80%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        overflow: 'hidden'
    });

    // 创建文本区域
    const textarea = document.createElement('textarea');
    textarea.value = markdownContent;
    Object.assign(textarea.style, {
        flex: '1',
        resize: 'none',
        width: '100%',
        padding: '10px',
        fontSize: '14px',
        fontFamily: 'monospace',
        marginBottom: '10px',
        boxSizing: 'border-box',
        color: '#000',
        backgroundColor: '#f9f9f9',
        border: '1px solid #ccc',
        borderRadius: '4px'
    });
    textarea.setAttribute('readonly', true);

    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    Object.assign(buttonContainer.style, {
        display: 'flex',
        justifyContent: 'flex-end'
    });

    // 创建复制按钮
    const copyButton = document.createElement('button');
    copyButton.textContent = '复制';
    Object.assign(copyButton.style, {
        padding: '8px 16px',
        fontSize: '14px',
        cursor: 'pointer',
        backgroundColor: '#28A745',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        marginRight: '10px'
    });

    // 创建关闭按钮
    const closeButton = document.createElement('button');
    closeButton.textContent = '关闭';
    Object.assign(closeButton.style, {
        padding: '8px 16px',
        fontSize: '14px',
        cursor: 'pointer',
        backgroundColor: '#007BFF',
        color: '#fff',
        border: 'none',
        borderRadius: '4px'
    });

    buttonContainer.appendChild(copyButton);
    buttonContainer.appendChild(closeButton);
    modalContent.appendChild(textarea);
    modalContent.appendChild(buttonContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    textarea.focus();

    copyButton.addEventListener('click', () => {
        textarea.select();
        navigator.clipboard.writeText(textarea.value)
            .then(() => {
                copyButton.textContent = '已复制';
                setTimeout(() => {
                    copyButton.textContent = '复制';
                }, 2000);
            })
            .catch(err => console.error('复制失败', err));
    });

    closeButton.addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    const escListener = (e) => {
        if (e.key === 'Escape' && document.getElementById('markdown-modal')) {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', escListener);
        }
    };
    document.addEventListener('keydown', escListener);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', escListener);
        }
    });
}

// 创建导出按钮
function createExportButton() {
    const exportButton = document.createElement('button');
    exportButton.textContent = 'Export Chat';
    exportButton.id = 'export-chat';
    const styles = {
        position: 'fixed',
        height: '36px',
        top: '10px',
        right: '35%',
        zIndex: '10000',
        padding: '10px',
        backgroundColor: '#4cafa3',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        textAlign: 'center',
        lineHeight: '16px'
    };
    document.body.appendChild(exportButton);
    Object.assign(exportButton.style, styles);
    exportButton.addEventListener('click', exportChatAsMarkdown);
}

function sanitizeFileNamePart(part) {
    if (!part) return 'chat';
    return part
        .replace(/[\\/:*?"<>|]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 80) || 'chat';
}

function logDebug(...args) {
    if (typeof console !== 'undefined' && console.log) {
        console.log('[AI Chat Exporter]', ...args);
    }
}

function formatTimestamp(timestampMs) {
    const date = new Date(timestampMs);
    const pad = (value) => String(value).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function getTextBySelectors(selectors) {
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            const text = element.textContent?.trim();
            if (text) {
                return text;
            }
        }
    }
    return '';
}

function getChatTitleFromDom() {
    const documentTitle = document.title?.trim();
    if (documentTitle) return documentTitle;

    const rootWebArea = document.querySelector('[role="application"][aria-label], [role="main"][aria-label], [role="dialog"][aria-label], [role="region"][aria-label], [role="document"][aria-label]');
    if (rootWebArea) {
        const ariaLabel = rootWebArea.getAttribute('aria-label');
        if (ariaLabel?.trim()) {
            return ariaLabel.trim();
        }
    }


    const conversationAreaSelectors = [
        '[role="application"] h1',
        '[role="application"] [aria-level="1"]',
        '[role="document"] h1',
        '[role="document"] [aria-level="1"]',
        'main h1',
        'main header h1',
        'main [data-testid="conversation-title"]',
        '[data-testid="conversation-view-title"]',
        '[data-testid="conversation-headline"]',
        '[data-testid="chat-title"]',
        'main [role="heading"]',
        '.conversation-header h1',
        '.prose h1',
        '.text-2xl.font-semibold.leading-tight'
    ];

    const contentTitle = getTextBySelectors(conversationAreaSelectors);
    if (contentTitle) {
        return contentTitle;
    }

    const activeSelectors = [
        'nav a[aria-current="page"] h3',
        'nav a[aria-current="page"] div',
        '[role="treeitem"][aria-current="page"] h3',
        '[role="treeitem"][aria-current="page"] div',
        'nav a[data-active="true"] h3',
        'nav a[data-active="true"] div',
        '[data-testid="conversation-list-item"][data-selected="true"]',
        '[data-testid="conversation-list-item"][aria-current="page"]',
        'aside div[role="treeitem"][aria-selected="true"] h3',
        'aside div[role="treeitem"][data-selected="true"] h3',
        '.chat-item__title[aria-selected="true"]',
        '.chat-item__title.is-active'
    ];

    const activeTitle = getTextBySelectors(activeSelectors);
    if (activeTitle) {
        return activeTitle;
    }

    const generalSelectors = [
        'nav a[href^="/c/"] div',
        'nav a[href^="/c/"] span',
        '[data-testid="conversation-turn-title"]',
        '[data-testid="conversation-name"]',
        'aside div[role="treeitem"] h3',
        '.chat-item__title'
    ];

    const generalTitle = getTextBySelectors(generalSelectors);
    if (generalTitle) {
        return generalTitle;
    }

    return '';
}

function extractTimestamp(element) {
    if (!element) return null;

    const attributeKeys = [
        'data-message-timestamp',
        'data-timestamp',
        'data-created-at'
    ];

    for (const key of attributeKeys) {
        const value = element.getAttribute ? element.getAttribute(key) : null;
        if (!value) continue;
        const numeric = Number(value);
        if (!Number.isNaN(numeric) && numeric > 0) {
            // 如果提供的是秒级时间戳，将其转换为毫秒
            return numeric < 1e12 ? numeric * 1000 : numeric;
        }
        const parsedDate = Date.parse(value);
        if (!Number.isNaN(parsedDate)) {
            return parsedDate;
        }
    }

    const timeEl = element.querySelector ? element.querySelector('time') : null;
    if (timeEl) {
        const datetimeValue = timeEl.getAttribute('datetime') || timeEl.textContent;
        const parsedDate = Date.parse(datetimeValue);
        if (!Number.isNaN(parsedDate)) {
            return parsedDate;
        }
    }

    return null;
}

function buildMarkdownFileName(allElements) {
    if (!allElements || !allElements.length) {
        const fallbackTimestamp = formatTimestamp(Date.now());
        return `${fallbackTimestamp}-chat.md`;
    }

    let chatNameSource = getChatTitleFromDom();
    if (!chatNameSource) {
        for (let i = 0; i < allElements.length; i += 2) {
            const candidate = allElements[i]?.textContent?.trim();
            if (candidate) {
                chatNameSource = candidate;
                break;
            }
        }
    }
    const chatName = sanitizeFileNamePart(chatNameSource || 'chat');

    const timestampMs = extractTimestamp(allElements[0]) ?? Date.now();
    const timestampFormatted = formatTimestamp(timestampMs);

    return `${timestampFormatted}-${chatName}.md`;
}

function buildFolderNameFromMarkdown(markdownFileName) {
    const base = (markdownFileName || '').replace(/\.md$/i, '').trim();
    return sanitizeFileNamePart(base || 'chat');
}

const IMAGE_EXTENSION_WHITELIST = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif']);
const IMAGE_MIME_EXTENSION_MAP = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
    'image/avif': 'avif'
};

function normalizeImageSrc(rawSrc) {
    if (!rawSrc) return '';
    try {
        return new URL(rawSrc, window.location.href).href;
    } catch (error) {
        return rawSrc;
    }
}

function normalizeImageExtension(extension) {
    if (!extension) return 'png';
    const cleaned = extension.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleaned === 'jpeg') return 'jpg';
    if (cleaned === 'jpe' || cleaned === 'jfif' || cleaned === 'pjpeg' || cleaned === 'pjpg') return 'jpg';
    if (cleaned === 'svgxml') return 'svg';
    if (cleaned === 'xicon') return 'ico';
    if (IMAGE_EXTENSION_WHITELIST.has(cleaned)) return cleaned;
    return 'png';
}

function extractExtensionFromValue(value) {
    if (!value) return '';
    const candidates = Array.isArray(value) ? value : [value];
    for (const candidate of candidates) {
        if (!candidate) continue;
        try {
            const decoded = decodeURIComponent(candidate);
            const urlCandidate = new URL(decoded, window.location.href);
            const match = urlCandidate.pathname.match(/\.([a-zA-Z0-9]+)$/);
            if (match && match[1]) {
                return normalizeImageExtension(match[1]);
            }
        } catch (error) {
            // ignore decode/URL parsing issues
        }
        const plainMatch = candidate.match(/\.([a-zA-Z0-9]+)(?:$|[?#])/);
        if (plainMatch && plainMatch[1]) {
            return normalizeImageExtension(plainMatch[1]);
        }
    }
    return '';
}

function getImageExtensionFromSrc(src) {
    if (!src) return 'png';
    if (src.startsWith('data:')) {
        const match = src.match(/^data:image\/([^;]+);/i);
        return normalizeImageExtension(match ? match[1] : 'png');
    }
    try {
        const url = new URL(src);
        const match = url.pathname.match(/\.([a-zA-Z0-9]+)$/);
        if (match && match[1]) {
            return normalizeImageExtension(match[1]);
        }
        const paramCandidates = ['format', 'fm', 'ext', 'type', 'url', 'image_url', 'img', 'image', 'filename', 'file', 'name', 'src'];
        for (const key of paramCandidates) {
            const value = url.searchParams.get(key);
            const extracted = extractExtensionFromValue(value);
            if (extracted) {
                return extracted;
            }
        }
        for (const [, value] of url.searchParams.entries()) {
            const extracted = extractExtensionFromValue(value);
            if (extracted) {
                return extracted;
            }
        }
    } catch (error) {
        return 'png';
    }
    return 'png';
}

function mimeToExtension(contentType) {
    if (!contentType) return '';
    const mime = contentType.split(';')[0].trim().toLowerCase();
    return IMAGE_MIME_EXTENSION_MAP[mime] || '';
}

function heuristicExtensionByHost(src) {
    try {
        const url = new URL(src, window.location.href);
        const host = url.hostname.toLowerCase();
        const path = url.pathname.toLowerCase();
        if (host.includes('bing.com') || host.includes('bing.net')) return 'jpg';
        if (path.includes('/oip.')) return 'jpg';
        return '';
    } catch (error) {
        return '';
    }
}

async function resolveExtensionFromHead(src, guessedExt) {
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
        return guessedExt;
    }
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const response = await fetch(src, {method: 'HEAD', credentials: 'include', signal: controller.signal});
        clearTimeout(timeoutId);
        if (!response.ok) return guessedExt;
        const contentType = response.headers?.get('content-type');
        const ext = mimeToExtension(contentType);
        logDebug('HEAD resolved image ext', {src, contentType, ext, guessedExt});
        return ext || guessedExt;
    } catch (error) {
        logDebug('HEAD resolve failed, fallback to guessed ext', {src, guessedExt, error: error?.message});
        return guessedExt;
    }
}

async function resolveExtensionFromGet(src, guessedExt) {
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
        return guessedExt;
    }
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(src, {
            method: 'GET',
            headers: {'Range': 'bytes=0-0'},
            credentials: 'include',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) return guessedExt;
        const contentType = response.headers?.get('content-type');
        const ext = mimeToExtension(contentType);
        logDebug('GET resolved image ext', {src, contentType, ext, guessedExt});
        return ext || guessedExt;
    } catch (error) {
        logDebug('GET resolve failed, fallback to guessed ext', {src, guessedExt, error: error?.message});
        return guessedExt;
    }
}

async function sniffExtensionFromBytes(src, guessedExt) {
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
        return guessedExt;
    }
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(src, {
            method: 'GET',
            headers: {'Range': 'bytes=0-15'},
            credentials: 'include',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) return guessedExt;
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
        if (
            bytes.length >= 8 &&
            bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
            bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
        ) return 'png';
        if (
            bytes.length >= 6 &&
            bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
            bytes[3] === 0x38 && (bytes[4] === 0x39 || bytes[4] === 0x37) && bytes[5] === 0x61
        ) return 'gif';
        if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';
        if (
            bytes.length >= 12 &&
            bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
            bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
        ) return 'webp';
        if (
            bytes.length >= 4 &&
            bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00
        ) return 'ico';
        if (
            bytes.length >= 12 &&
            bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 &&
            bytes[8] === 0x61 && bytes[9] === 0x76 && bytes[10] === 0x69 && bytes[11] === 0x66
        ) return 'avif';
        return guessedExt;
    } catch (error) {
        logDebug('Byte sniff failed, fallback to guessed ext', {src, guessedExt, error: error?.message});
        return guessedExt;
    }
}

async function resolveImageExtension(src) {
    const guessed = getImageExtensionFromSrc(src);
    const hostHeuristic = heuristicExtensionByHost(src);
    const fromHead = await resolveExtensionFromHead(src, guessed);
    const fromGet = await resolveExtensionFromGet(src, fromHead || guessed || hostHeuristic);
    const fromBytes = await sniffExtensionFromBytes(src, fromGet || fromHead || hostHeuristic || guessed);
    const finalExt = normalizeImageExtension(fromBytes || fromGet || fromHead || hostHeuristic || guessed || 'jpg');
    logDebug('Image extension resolution', {src, guessed, hostHeuristic, fromHead, fromGet, fromBytes, finalExt});
    return {finalExt, guessed, hostHeuristic, fromHead, fromGet, fromBytes};
}

function collectImageSources(allElements) {
    const images = [];
    const seen = new Set();
    if (!allElements) return images;
    allElements.forEach(element => {
        if (!element || !element.querySelectorAll) return;
        element.querySelectorAll('img').forEach(img => {
            const rawSrc = img.currentSrc || img.getAttribute('src') || img.src;
            const src = normalizeImageSrc(rawSrc);
            if (!src || seen.has(src)) return;
            seen.add(src);
            images.push({src});
        });
    });
    logDebug('Collected image sources', {count: images.length, samples: images.slice(0, 5)});
    return images;
}

async function buildImagePlan(allElements) {
    const images = collectImageSources(allElements);
    const imageMap = new Map();
    const extensions = await Promise.all(images.map(image => resolveImageExtension(image.src)));
    const imageDownloads = images.map((image, index) => {
        const extResult = extensions[index] || {};
        const extension = extResult.finalExt || 'png';
        const safeExt = IMAGE_EXTENSION_WHITELIST.has(extension) ? extension : 'png';
        const fileName = `image-${String(index + 1).padStart(2, '0')}.${safeExt}`;
        const localPath = `images/${fileName}`;
        imageMap.set(image.src, localPath);
        const noQuery = image.src.split('?')[0];
        if (noQuery && noQuery !== image.src) {
            imageMap.set(noQuery, localPath);
        }
        logDebug('Image plan entry', {
            index,
            src: image.src,
            fileName,
            extension,
            safeExt,
            resolution: extResult
        });
        return {src: image.src, fileName};
    });
    logDebug('Built image plan', {total: imageDownloads.length, imageDownloads: imageDownloads.slice(0, 5)});
    return {imageMap, imageDownloads};
}

function requestExportDownload(payload) {
    logDebug('Requesting export download', payload);
    chrome.runtime.sendMessage(
        {action: 'downloadChatExport', payload},
        (response) => {
            if (chrome.runtime.lastError) {
                console.error('Export failed', chrome.runtime.lastError);
                return;
            }
            if (!response || !response.success) {
                console.error('Export failed', response?.error || 'Unknown error', response);
            } else {
                logDebug('Export download response', response);
            }
        }
    );
}

async function downloadMarkdownWithDirectory({allElements, markdownContent, imagePlan}) {
    if (!markdownContent) return;
    const filename = buildMarkdownFileName(allElements);
    const folderName = buildFolderNameFromMarkdown(filename);
    const directoryName = folderName; // legacy alias to avoid ReferenceError
    const {imageMap, imageDownloads} = imagePlan || await buildImagePlan(allElements);

    logDebug('Preparing download', {folderName, filename, images: imageDownloads.length});

    requestExportDownload({
        folderName,
        directoryName,
        markdownFileName: filename,
        markdownContent,
        images: imageDownloads
    });

    return {folderName, markdownFileName: filename, imageMap};
}

// 导出聊天记录为 Markdown 格式
async function exportChatAsMarkdown() {
    let markdownContent = "";
    let allElements = getConversationElements();
    const imagePlan = await buildImagePlan(allElements);
    const {imageMap} = imagePlan;

    for (let i = 0; i < allElements.length; i += 2) {
        if (!allElements[i + 1]) break; // 防止越界
        let userHtml = allElements[i].innerHTML.trim();
        let answerHtml = allElements[i + 1].innerHTML.trim();

        userHtml = htmlToMarkdown(userHtml, imageMap);
        answerHtml = htmlToMarkdown(answerHtml, imageMap);

        // const isGrok = window.location.href.includes("grok.com");
        // markdownContent += `\n# 用户问题\n${userText}\n# ${isGrok ? 'Grok' : 'ChatGPT'}\n${answerHtml}`;
        markdownContent += `\n# 用户问题\n${userHtml}\n# 回答\n${answerHtml}`;
    }
    markdownContent = markdownContent.replace(/&amp;/g, '&');

    if (markdownContent) {
        await downloadMarkdownWithDirectory({allElements, markdownContent, imagePlan});
    } else {
        console.log("未找到对话内容");
    }
}

// 将 HTML 转换为 Markdown
function htmlToMarkdown(html, imageMap) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 1. 处理公式
    // FIXME: Gemini 公式处理时渲染使用html前端渲染控制角标等，所以行内公式只能按照文本格式显示
    if (!isGemini) {
        doc.querySelectorAll('span.katex-html').forEach(element => element.remove());
    }
    doc.querySelectorAll('mrow').forEach(mrow => mrow.remove());
    doc.querySelectorAll('annotation[encoding="application/x-tex"]').forEach(element => {
        if (element.closest('.katex-display')) {
            const latex = element.textContent;
            // 删除latex两边的空格
            const trimmedLatex = latex.trim();
            element.replaceWith(`\n$$\n${trimmedLatex}\n$$\n`);
        } else {
            const latex = element.textContent;
            const trimmedLatex = latex.trim();
            element.replaceWith(`$${trimmedLatex}$`);
        }
    });

    // 2. 加粗处理
    doc.querySelectorAll('strong, b').forEach(bold => {
        const markdownBold = `**${bold.textContent}**`;
        bold.parentNode.replaceChild(document.createTextNode(markdownBold), bold);
    });

    // 3. 斜体处理
    doc.querySelectorAll('em, i').forEach(italic => {
        const markdownItalic = `*${italic.textContent}*`;
        italic.parentNode.replaceChild(document.createTextNode(markdownItalic), italic);
    });

    // 4. 行内代码处理
    doc.querySelectorAll('p code').forEach(code => {
        const markdownCode = `\`${code.textContent}\``;
        code.parentNode.replaceChild(document.createTextNode(markdownCode), code);
    });

    // 5. 链接处理
    doc.querySelectorAll('a').forEach(link => {
        const markdownLink = `[${link.textContent}](${link.href})`;
        link.parentNode.replaceChild(document.createTextNode(markdownLink), link);
    });

    // 6. 处理图片
    doc.querySelectorAll('img').forEach(img => {
        const rawSrc = img.getAttribute('src') || img.src;
        const normalizedSrc = normalizeImageSrc(rawSrc);
        const normalizedNoQuery = normalizedSrc.split('?')[0];
        let localPath = imageMap?.get(normalizedSrc) || imageMap?.get(normalizedNoQuery);
        if (!localPath) {
            localPath = normalizedSrc;
        }
        logDebug('Image markdown mapping', {rawSrc, normalizedSrc, normalizedNoQuery, localPath});
        const alt = img.alt || 'image';
        const markdownImage = `![${alt}](${localPath || normalizedSrc})`;
        img.parentNode.replaceChild(document.createTextNode(markdownImage), img);
    });

    // 7. 代码块处理
    if (isChatGPT) {
        doc.querySelectorAll('pre').forEach(pre => {
            const codeType = pre.querySelector('div > div:first-child')?.textContent || '';
            const markdownCode = pre.querySelector('div > div:nth-child(3) > code')?.textContent || pre.textContent;
            pre.innerHTML = `\n\`\`\`${codeType}\n${markdownCode}\n\`\`\``;
        });
    } else if (isGrok) {
        // 控制台打印
        // 选择 class="not-prose" 的 div
        doc.querySelectorAll('div.not-prose').forEach(div => {

            // 获取第一个子元素的文本内容
            const codeType = div.querySelector('div > div > span')?.textContent || '';
            // 获取第三个子元素的文本内容
            const markdownCode = div.querySelector('div > div:nth-child(3) > code')?.textContent || div.textContent;
            // 替换内容
            div.innerHTML = `\n\`\`\`${codeType}\n${markdownCode}\n\`\`\``;
        });
    } else if (isGemini) {
        // 取出class="code-block“
        doc.querySelectorAll('code-block').forEach(div => {
            const codeType = div.querySelector('div > div > span')?.textContent || '';
            const markdownCode = div.querySelector('div > div:nth-child(2) > div > pre')?.textContent || div.textContent;
            div.innerHTML = `\n\`\`\`${codeType}\n${markdownCode}\n\`\`\``;
        });
    }

    // 8. 处理列表
    doc.querySelectorAll('ul').forEach(ul => {
        let markdown = '';
        ul.querySelectorAll(':scope > li').forEach(li => {
            markdown += `- ${li.textContent.trim()}\n`;
        });
        ul.parentNode.replaceChild(document.createTextNode('\n' + markdown.trim()), ul);
    });

    doc.querySelectorAll('ol').forEach(ol => {
        let markdown = '';
        ol.querySelectorAll(':scope > li').forEach((li, index) => {
            markdown += `${index + 1}. ${li.textContent.trim()}\n`;
        });
        ol.parentNode.replaceChild(document.createTextNode('\n' + markdown.trim()), ol);
    });

    // 9. 标题处理
    for (let i = 1; i <= 6; i++) {
        doc.querySelectorAll(`h${i}`).forEach(header => {
            const markdownHeader = '\n' + `${'#'.repeat(i)} ${header.textContent}\n`;
            header.parentNode.replaceChild(document.createTextNode(markdownHeader), header);
        });
    }

    // 10. 段落处理
    doc.querySelectorAll('p').forEach(p => {
        const markdownParagraph = '\n' + p.textContent + '\n';
        p.parentNode.replaceChild(document.createTextNode(markdownParagraph), p);
    });

    // 11. 表格处理
    doc.querySelectorAll('table').forEach(table => {
        let markdown = '';
        table.querySelectorAll('thead tr').forEach(tr => {
            tr.querySelectorAll('th').forEach(th => {
                markdown += `| ${th.textContent} `;
            });
            markdown += '|\n';
            tr.querySelectorAll('th').forEach(() => {
                markdown += '| ---- ';
            });
            markdown += '|\n';
        });
        table.querySelectorAll('tbody tr').forEach(tr => {
            tr.querySelectorAll('td').forEach(td => {
                markdown += `| ${td.textContent} `;
            });
            markdown += '|\n';
        });
        table.parentNode.replaceChild(document.createTextNode('\n' + markdown.trim() + '\n'), table);
    });

    // 12. 处理引用块（只能处理一级引用，不能处理嵌套引用）
    doc.querySelectorAll('blockquote').forEach(blockquote => {
        const lines = blockquote.textContent.trim().split('\n');
        const markdownQuote = lines.map(line => `> ${line.trim()}`).join('\n');
        blockquote.parentNode.replaceChild(document.createTextNode('\n' + markdownQuote + '\n'), blockquote);
    });

    let markdown = doc.body.textContent || '';

    return markdown.trim();

    // let markdown = doc.body.innerHTML.replace(/<[^>]*>/g, '');
    // markdown = markdown.replaceAll(/- &gt;/g, '- $\\gt$');
    // markdown = markdown.replaceAll(/>/g, '>');
    // markdown = markdown.replaceAll(/</g, '<');
    // markdown = markdown.replaceAll(/≥/g, '>=');
    // markdown = markdown.replaceAll(/≤/g, '<=');
    // markdown = markdown.replaceAll(/≠/g, '\\neq');

    // return markdown.trim();
}
