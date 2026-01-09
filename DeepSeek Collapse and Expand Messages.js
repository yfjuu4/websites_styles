// ==UserScript==
// @name         DeepSeek Collapse and Expand Messages
// @namespace    https://github.com/ChinaGodMan/UserScripts
// @version      1.1.1
// @description  Add "Collapse or Expand" buttons to DeepSeek messages. Auto-collapse specific user phrases. Fixed scrollbar update issue.
// @match        https://chat.deepseek.com/*
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    const autoCollapsePhrases = [
        "This message should automatically and always be collapsed",
        "This prompt must automatically and always be folded",
        "Ce message doit automatiquement et toujours être replié",
        " to explain is:",
        "sentence to translate into ",
        "à traduire en ",
        "Other additional sections",
        "extract only the following specific sections",
        "Autres sections supplémentaires pour le mot",
        "pour la forme pronominale:",
        " à expliquer est:",
        "please suggest a well-phrased"
    ];

    const processedMessages = new WeakSet();

    // DeepSeek-specific selectors
    const DEEPSEEK_SELECTORS = {
        message: '[data-testid*="message"], .message, [class*="message"], .chat-message, [class*="chat-message"], [class*="message-"]',
        userMessage: '[data-message-author-role="user"], .user-message, [class*="user-message"], [data-author="user"], [class*="user"]',
        assistantMessage: '[data-message-author-role="assistant"], .assistant-message, [class*="assistant-message"], [data-author="assistant"], [class*="assistant"]',
        messageContent: '.message-content, [class*="content"], .prose, .markdown, [class*="prose"]'
    };

    function refreshScrollbar() {
        // Try multiple possible scroll containers
        const scrollContainers = [
            '.ds-scroll-area',
            '[class*="_0f72b72b"]', 
            '[class*="ds-scroll"]',
            '.overflow-auto',
            '.overflow-y-auto',
            '[class*="scroll"]'
        ];
        
        scrollContainers.forEach(selector => {
            const containers = document.querySelectorAll(selector);
            containers.forEach(container => {
                if (container.scrollHeight > container.clientHeight) {
                    // Force reflow by toggling a class
                    container.style.overflow = 'hidden';
                    // Force reflow
                    void container.offsetHeight;
                    container.style.overflow = '';
                    
                    // Alternative: trigger scroll event
                    const event = new Event('scroll', { bubbles: true });
                    container.dispatchEvent(event);
                }
            });
        });
        
        // Also try on body/html
        window.dispatchEvent(new Event('resize'));
        document.dispatchEvent(new Event('scroll'));
    }

    function generateMessageId(message, index) {
        const content = getMessageText(message);
        return `deepseek-message-${index}-${content.substring(0, 30).replace(/\s+/g, '_')}`;
    }

    function getMessageText(message) {
        // Try to find the actual content area for DeepSeek
        const contentEl = message.querySelector(DEEPSEEK_SELECTORS.messageContent) ||
                         message.querySelector('.prose') ||
                         message.querySelector('.markdown') ||
                         message.querySelector('[class*="content"]') ||
                         message;
        return contentEl.innerText || contentEl.textContent || '';
    }

    function getMessageRole(message) {
        // Try various ways to detect user messages in DeepSeek
        if (message.matches(DEEPSEEK_SELECTORS.userMessage) ||
            message.closest(DEEPSEEK_SELECTORS.userMessage)) {
            return 'user';
        }
        if (message.matches(DEEPSEEK_SELECTORS.assistantMessage) ||
            message.closest(DEEPSEEK_SELECTORS.assistantMessage)) {
            return 'assistant';
        }
       
        // Fallback: check for user indicators in class names or attributes
        if (message.className?.includes('user') ||
            message.getAttribute('data-author') === 'user' ||
            message.querySelector('[class*="user"]')) {
            return 'user';
        }
        if (message.className?.includes('assistant') ||
            message.getAttribute('data-author') === 'assistant' ||
            message.querySelector('[class*="assistant"]')) {
            return 'assistant';
        }
       
        // Default to assistant for DeepSeek if we can't determine
        return 'assistant';
    }

    function shouldProcessMessage(message) {
        if (!message || processedMessages.has(message)) return false;
       
        const role = getMessageRole(message);
        const text = getMessageText(message);
       
        // Only process messages with substantial content
        return text && text.length > 10 && (role === 'user' || role === 'assistant');
    }

    function createToggleButton(message, messageId, isAutoCollapsed, isUserMessage) {
        // Remove existing toggle button if present
        const existingButton = message.previousElementSibling?.classList?.contains('deepseek-toggle-button')
            ? message.previousElementSibling
            : null;
        if (existingButton) {
            existingButton.remove();
        }

        const toggleButton = document.createElement('button');
        toggleButton.textContent = isAutoCollapsed ? 'Expand' : 'Collapse';
        toggleButton.style.backgroundColor = isUserMessage ? (isAutoCollapsed ? 'green' : 'blue') : '#a30000';
        toggleButton.style.color = '#c6cdb0';
        toggleButton.style.border = 'none';
        toggleButton.style.padding = '8px 16px';
        toggleButton.style.margin = '0 auto 10px auto';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.borderRadius = '6px';
        toggleButton.style.fontSize = '12px';
        toggleButton.style.fontWeight = 'bold';
        toggleButton.style.width = '460px';
        toggleButton.style.display = 'block';
        toggleButton.style.transition = 'all 0.2s ease';
        toggleButton.classList.add('deepseek-toggle-button');

        // Create a container to center the button
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'center';
        buttonContainer.style.width = '100%';
        buttonContainer.appendChild(toggleButton);

        // Insert button container before the message
        if (message.parentElement) {
            message.parentElement.insertBefore(buttonContainer, message);
        } else {
            message.insertAdjacentElement('beforebegin', buttonContainer);
        }

        toggleButton.addEventListener('click', function () {
            const collapsed = message.classList.toggle('deepseek-collapsed');
            if (collapsed) {
                message.style.overflow = 'hidden';
                message.style.maxHeight = '100px';
                message.style.position = 'relative';
                localStorage.setItem(messageId, 'collapsed');
                toggleButton.textContent = 'Expand';
                toggleButton.style.backgroundColor = isUserMessage ? 'green' : '#a30000';
                toggleButton.style.width = '460px';
            } else {
                message.style.overflow = 'visible';
                message.style.maxHeight = 'none';
                message.style.position = '';
                localStorage.setItem(messageId, 'expanded');
                toggleButton.textContent = 'Collapse';
                toggleButton.style.backgroundColor = isUserMessage ? 'blue' : '#a30000';
                toggleButton.style.width = '360px';
            }
            
            // Force scrollbar to update immediately
            setTimeout(refreshScrollbar, 10);
        });

        return buttonContainer;
    }

    function processMessage(message, index) {
        if (!shouldProcessMessage(message)) return;

        const role = getMessageRole(message);
        const isUserMessage = role === 'user';
        const messageText = getMessageText(message);
        const messageId = generateMessageId(message, index);
        const storedState = localStorage.getItem(messageId);

        // Check if message is tall enough to need collapsing
        const messageHeight = message.offsetHeight || message.scrollHeight;
        if (messageHeight < 150 && !isUserMessage) return;

        const isAutoCollapsed = isUserMessage && autoCollapsePhrases.some(phrase =>
            messageText.toLowerCase().includes(phrase.toLowerCase())
        );

        const buttonContainer = createToggleButton(message, messageId, isAutoCollapsed, isUserMessage);
        const toggleButton = buttonContainer.querySelector('button');

        // Apply initial state
        if (isAutoCollapsed && storedState !== 'expanded') {
            message.style.overflow = 'hidden';
            message.style.maxHeight = '100px';
            message.style.position = 'relative';
            message.classList.add('deepseek-collapsed');
            toggleButton.textContent = 'Expand';
            toggleButton.style.backgroundColor = isUserMessage ? 'green' : '#a30000';
            
            // Refresh scrollbar for initial auto-collapsed state
            setTimeout(refreshScrollbar, 100);
        } else if (storedState === 'collapsed') {
            message.style.overflow = 'hidden';
            message.style.maxHeight = '100px';
            message.style.position = 'relative';
            message.classList.add('deepseek-collapsed');
            toggleButton.textContent = 'Expand';
            toggleButton.style.backgroundColor = isUserMessage ? 'green' : '#a30000';
        } else {
            message.style.overflow = 'visible';
            message.style.maxHeight = 'none';
            message.style.position = '';
            message.classList.remove('deepseek-collapsed');
            toggleButton.textContent = 'Collapse';
            toggleButton.style.backgroundColor = isUserMessage ? 'blue' : '#a30000';
        }

        processedMessages.add(message);
    }

    function findAndProcessMessages() {
        // Multiple possible selectors for DeepSeek messages
        let messages = document.querySelectorAll(DEEPSEEK_SELECTORS.message);
       
        // If no messages found with specific selectors, try more generic approach
        if (messages.length === 0) {
            messages = document.querySelectorAll('[class*="message"]');
        }

        // Also try to find messages by looking for common DeepSeek structures
        if (messages.length === 0) {
            const containers = document.querySelectorAll('[class*="chat"], [class*="conversation"], main, [role="log"]');
            containers.forEach(container => {
                const containerMessages = container.querySelectorAll('div[class]');
                containerMessages.forEach(msg => {
                    if (msg.className && typeof msg.className === 'string' &&
                        (msg.className.includes('message') || msg.className.includes('Message'))) {
                        processMessage(msg, Array.from(messages).length);
                    }
                });
            });
        } else {
            messages.forEach((msg, i) => processMessage(msg, i));
        }
    }

    function observeMessages() {
        const observer = new MutationObserver(() => {
            findAndProcessMessages();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'data-message-author-role', 'data-author']
        });

        // Also observe for new messages added to the DOM
        const chatObserver = new MutationObserver(() => {
            findAndProcessMessages();
        });

        // Try to find the main chat container
        const chatContainer = document.querySelector('main, .chat-container, [class*="chat"], [class*="messages"], [class*="conversation"]') || document.body;
        chatObserver.observe(chatContainer, {
            childList: true,
            subtree: true
        });
    }

    // Enhanced styles for DeepSeek
    const style = document.createElement('style');
    style.textContent = `
        .deepseek-collapsed {
            position: relative;
            overflow: hidden;
            max-height: 100px;
        }
        .deepseek-collapsed::after {
            content: "";
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 30px;
            background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.8));
            pointer-events: none;
        }
        .dark .deepseek-collapsed::after {
            background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.8));
        }
        .deepseek-toggle-button {
            display: block;
            text-align: center;
            z-index: 1000;
            position: relative;
            transition: all 0.2s ease;
        }
        .deepseek-toggle-button:hover {
            opacity: 0.8;
            transform: scale(1.05);
        }
    `;
    document.head.appendChild(style);

    // Initialize
    function initialize() {
        // Wait a bit for DeepSeek to load its interface
        setTimeout(() => {
            observeMessages();
            findAndProcessMessages();
        }, 2000);
       
        // Also try processing after a longer delay in case of slow loading
        setTimeout(findAndProcessMessages, 5000);
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
