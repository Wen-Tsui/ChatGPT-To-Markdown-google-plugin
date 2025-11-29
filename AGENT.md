# AI Agent Onboarding Guide for "AI Chat Exporter"

Welcome, AI Agent! This guide will help you understand, debug, and extend the "AI Chat Exporter" Chrome extension.

## 1. Project Overview

This is a Chrome extension that allows users to export their conversations from AI platforms like ChatGPT, Grok, and Gemini into standard Markdown format.

**Core Features:**
- **Cross-platform:** Supports multiple AI chat services.
- **Rich Content Export:** Preserves code blocks, math formulas, lists, tables, and text formatting.
- **Dual Export Modes:** Users can either download a `.md` file or copy the content to the clipboard.
- **UI Control:** The in-page export button can be toggled via the extension's popup.

## 2. Tech Stack

- **Language:** **Vanilla JavaScript (ES6+)**. No frameworks like React or Vue are used.
- **APIs:** Standard Chrome Extension APIs (`chrome.runtime`, `chrome.tabs`).
- **Build Process:** There is **no build process** (no webpack, rollup, etc.). Development is done by loading the unpacked extension directly into Chrome.
- **Styling:** Inline CSS and simple stylesheets.

## 3. Code Structure

The project is composed of three main JavaScript files:

- `content.js`: **This is the most important file.**
  - **Responsibilities:**
    - Detects which AI platform is currently active.
    - Injects the "Export Chat" button into the page.
    - Contains the core logic for scraping the conversation from the DOM (`getConversationElements`).
    - Implements the `htmlToMarkdown` function, which converts the platform-specific HTML into standard Markdown.
    - Listens for messages from `popup.js` to trigger actions.

- `popup.js`:
  - **Responsibilities:**
    - Handles the logic for the extension's popup window (`popup.html`).
    - Sends messages to `content.js` to initiate actions like "export" or "copy".
    - Manages the state of the "Show Export Button" toggle switch.

- `background.js`:
  - **Responsibilities:**
    - Runs as a background service worker.
    - Currently, it only has a simple `onInstalled` listener. It's not critical to the core functionality but could be used for more complex background tasks.

## 4. How to Get Started & Debug

Since there is no build step, the development workflow is straightforward:

1.  **Load the Extension:**
    - Open Chrome and navigate to `chrome://extensions/`.
    - Enable "Developer mode".
    - Click "Load unpacked" and select the project's root folder.

2.  **Making Changes:**
    - Modify the JavaScript files directly (`content.js`, `popup.js`, etc.).
    - After saving your changes, go back to `chrome://extensions/` and click the "Reload" button for the extension.
    - Refresh the target AI platform page (e.g., chat.openai.com) to see your changes.

3.  **Debugging `content.js`:**
    - Open the developer tools on the AI platform's page (Right-click -> Inspect).
    - You can use `console.log()` in `content.js` to print debug information.
    - Use the "Elements" tab to inspect the DOM structure of the AI platform, which is crucial for fixing selectors.
    - Use the "Sources" tab to find `content.js` and set breakpoints to debug its execution.

4.  **Debugging `popup.js`:**
    - Open the extension's popup by clicking its icon in the Chrome toolbar.
    - Right-click inside the popup and select "Inspect" to open a dedicated developer tools window for the popup.
    - You can then debug `popup.js` in the same way.

## 5. Common Tasks

### Task A: Fixing a Bug in Markdown Conversion

**Problem:** An AI platform updated its HTML, and now code blocks are not being exported correctly.

**Workflow:**
1.  **Identify the file:** The conversion logic is in `htmlToMarkdown` within `content.js`.
2.  **Inspect the DOM:** Go to the AI platform's page, right-click on the element that is broken (e.g., a code block), and "Inspect" it. Analyze its new HTML structure and CSS selectors.
3.  **Update the Selector:** In `content.js`, find the relevant part of `htmlToMarkdown` (e.g., the section for "代码块处理"). Update the `doc.querySelectorAll(...)` call with the new, correct selector.
4.  **Adjust the Logic:** You may need to change how you extract the text or attributes from the new HTML structure.
5.  **Test:** Reload the extension and the page, then try exporting again.

### Task B: Adding Support for a New AI Platform

**Problem:** You want to add support for a new platform, "FutureAI".

**Workflow:**
1.  **Update `manifest.json`:**
    - Add the URL of the new platform to the `matches` array under `content_scripts`. For example: `"https://chat.futureai.com/*"`.

2.  **Analyze `content.js`:**
    - **`getConversationElements` function:**
        - Add a new `else if` block to detect the new platform's URL (`window.location.href.includes("futureai.com")`).
        - Inspect the DOM of "FutureAI" to find the correct selectors for the main conversation container and individual user/AI messages.
        - Implement the logic to query and return these elements.

    - **`htmlToMarkdown` function:**
        - The existing conversion logic might work, but it's likely you'll need to add specific overrides for "FutureAI".
        - For each type of content (code blocks, lists, etc.), check if the platform uses unique HTML that needs special handling. If so, add a new `else if (isFutureAI)` block in the relevant section to handle it.

3.  **Testing and Debugging:**
    - This is an iterative process. You will likely need to:
        - Export a conversation.
        - Check the broken parts of the output Markdown.
        - Inspect the corresponding HTML on the "FutureAI" page.
        - Tweak your selectors and logic in `content.js`.
        - Reload and repeat until the output is perfect.

By following this guide, you should be well-equipped to maintain and enhance the "AI Chat Exporter" extension. Good luck!
