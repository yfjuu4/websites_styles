// ==UserScript==
// @name         Universal AI Chat Styler - CSP Compatible
// @namespace    http://yourdomain.example
// @version      4.0
// @description  ChatGPT/Claude CSS styler with CSP workaround for Berry Browser
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @run-at       document-start  // CRITICAL: Changed to document-start for CSP workaround
// ==/UserScript==

(function() {
'use strict';

// 🎯 Configuration
const CONFIG = {
    DEBUG_MODE: true,
    MAX_RETRIES: 10,
    CACHE_DURATION: 12 * 60 * 60 * 1000,
    CACHE_KEY_PREFIX: 'css_csp_',
    
    // Site-specific delays
    CHATGPT_DELAY: 3000,
    CLAUDE_DELAY: 1000,
    
    // CSS fallback content (embedded as last resort)
    EMBEDDED_CSS: {
        'chatgpt.com': `body { background-color: red !important; border: 5px green solid; }`,
        'claude.ai': `body { background-color: green !important; border: 5px red solid; }`
    }
};

// 🎨 Site configuration
const SITES = {
    'chatgpt.com': {
        name: 'ChatGPT',
        cssURLs: [
            // Primary: jsDelivr CDN
            'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/ChatGpt_style.css',
            // Fallback: GitHub raw
            'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/ChatGpt_style.css'
        ],
        styleID: 'chatgpt-custom-css',
        // ChatGPT-specific CSP workaround settings
        useLinkPreload: true,  // Use link element (works with CSP)
        waitForBody: true,     // Wait for body to exist
        retryOnFail: true      // Retry with different methods
    },
    'claude.ai': {
        name: 'Claude AI',
        cssURLs: [
            'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/Claude_AI_style.css',
            'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/Claude_AI_style.css'
        ],
        styleID: 'claude-custom-css',
        useLinkPreload: false,  // Claude doesn't need CSP workaround
        waitForBody: false,
        retryOnFail: false
    }
};

// 🏗️ Initialize
const currentSite = SITES[window.location.hostname];
if (!currentSite) return;

// 🔧 Simple logging
function log(msg, type = 'info') {
    if (!CONFIG.DEBUG_MODE && type === 'debug') return;
    const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${icon} [${currentSite.name}] ${msg}`);
}

// 📦 Storage helper
const storage = {
    get(key, defaultValue) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch {
            return defaultValue;
        }
    },
    
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    },
    
    getCachedCSS() {
        const key = CONFIG.CACHE_KEY_PREFIX + currentSite.name;
        const cached = this.get(key, null);
        if (!cached) return null;
        
        const { css, timestamp, url } = cached;
        const now = Date.now();
        
        // Check if cache is expired
        if (now - timestamp > CONFIG.CACHE_DURATION) {
            this.clearCache();
            return null;
        }
        
        // Verify at least one URL matches
        if (!currentSite.cssURLs.includes(url)) {
            return null;
        }
        
        log(`Using cached CSS (${Math.round((now - timestamp)/60000)}min old)`, 'debug');
        return css;
    },
    
    setCachedCSS(css, url) {
        const key = CONFIG.CACHE_KEY_PREFIX + currentSite.name;
        return this.set(key, {
            css,
            timestamp: Date.now(),
            url,
            version: '4.0'
        });
    },
    
    clearCache() {
        Object.keys(localStorage)
            .filter(k => k.startsWith(CONFIG.CACHE_KEY_PREFIX))
            .forEach(k => localStorage.removeItem(k));
    }
};

// 🎨 CSS Manager - Core Fix for ChatGPT
class CSSManager {
    constructor() {
        this.attempts = 0;
        this.applied = false;
        this.currentMethod = null;
    }
    
    // 🚀 MAIN ENTRY POINT
    async applyCSS() {
        if (this.applied) return true;
        
        log(`Starting CSS application (Attempt: ${this.attempts + 1})`, 'info');
        
        // Strategy 1: Try cached CSS first
        const cached = storage.getCachedCSS();
        if (cached) {
            if (this.injectStyleElement(cached)) {
                log('Applied from cache', 'success');
                return true;
            }
        }
        
        // Strategy 2: Site-specific approaches
        if (currentSite.useLinkPreload) {
            // 🎯 CHATGPT: Use CSP-friendly link preload
            return await this.applyForChatGPT();
        } else {
            // 🎯 CLAUDE: Standard fetch (works fine)
            return await this.applyForClaude();
        }
    }
    
    // 🔧 For ChatGPT: CSP-compatible methods
    async applyForChatGPT() {
        log('Using ChatGPT CSP workaround...', 'debug');
        
        // Method 1: Link preload (CSP-friendly)
        if (await this.tryLinkPreload()) {
            this.currentMethod = 'link-preload';
            return true;
        }
        
        // Method 2: Iframe proxy (bypasses CSP)
        if (await this.tryIframeProxy()) {
            this.currentMethod = 'iframe-proxy';
            return true;
        }
        
        // Method 3: Data URL (embeds CSS in URL)
        if (await this.tryDataURL()) {
            this.currentMethod = 'data-url';
            return true;
        }
        
        // Method 4: Fallback to embedded CSS
        log('All methods failed, using embedded fallback', 'warning');
        return this.useEmbeddedFallback();
    }
    
    // 🔧 For Claude: Standard fetch
    async applyForClaude() {
        log('Using standard fetch for Claude', 'debug');
        
        // Try each URL until one works
        for (const url of currentSite.cssURLs) {
            try {
                const css = await this.fetchCSS(url);
                if (css && this.injectStyleElement(css)) {
                    storage.setCachedCSS(css, url);
                    this.currentMethod = 'fetch';
                    return true;
                }
            } catch (error) {
                log(`Fetch failed for ${url}: ${error.message}`, 'debug');
            }
        }
        
        // Fallback
        return this.useEmbeddedFallback();
    }
    
    // 💡 METHOD 1: Link Preload (CSP-friendly for ChatGPT)
    async tryLinkPreload() {
        return new Promise((resolve) => {
            log('Trying link preload method...', 'debug');
            
            // Create link element
            const link = document.createElement('link');
            link.id = currentSite.styleID;
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = currentSite.cssURLs[0]; // Use jsDelivr URL
            link.crossOrigin = 'anonymous';
            
            // Event handlers
            link.onload = () => {
                log('Link preload successful!', 'success');
                resolve(true);
            };
            
            link.onerror = () => {
                log('Link preload failed', 'debug');
                link.remove();
                resolve(false);
            };
            
            // Add to document
            if (document.head) {
                document.head.appendChild(link);
            } else {
                // Wait for head to exist
                const observer = new MutationObserver(() => {
                    if (document.head) {
                        observer.disconnect();
                        document.head.appendChild(link);
                    }
                });
                observer.observe(document.documentElement, { childList: true });
            }
            
            // Timeout
            setTimeout(() => {
                if (!link.sheet) {
                    link.remove();
                    resolve(false);
                }
            }, 5000);
        });
    }
    
    // 💡 METHOD 2: Iframe Proxy (CSP bypass)
    async tryIframeProxy() {
        return new Promise((resolve) => {
            log('Trying iframe proxy method...', 'debug');
            
            // Create hidden iframe
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.srcdoc = `
                <!DOCTYPE html>
                <html>
                <head>
                    <link rel="stylesheet" href="${currentSite.cssURLs[0]}" crossorigin="anonymous">
                </head>
                <body>
                    <div id="status"></div>
                    <script>
                        document.querySelector('link').onload = function() {
                            parent.postMessage({type: 'css-loaded', css: document.styleSheets[0].cssRules[0].cssText}, '*');
                        };
                    </script>
                </body>
                </html>
            `;
            
            // Message handler
            const messageHandler = (event) => {
                if (event.data.type === 'css-loaded' && event.data.css) {
                    window.removeEventListener('message', messageHandler);
                    iframe.remove();
                    
                    // Extract and inject CSS
                    const cssText = event.data.css;
                    if (this.injectStyleElement(cssText)) {
                        log('Iframe proxy successful!', 'success');
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }
            };
            
            window.addEventListener('message', messageHandler);
            document.body.appendChild(iframe);
            
            // Timeout
            setTimeout(() => {
                window.removeEventListener('message', messageHandler);
                iframe.remove();
                resolve(false);
            }, 7000);
        });
    }
    
    // 💡 METHOD 3: Data URL (Embed CSS in URL)
    async tryDataURL() {
        log('Trying data URL method...', 'debug');
        
        try {
            // First, try to fetch via CORS proxy (might work where direct fetch doesn't)
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(currentSite.cssURLs[0])}`;
            const response = await fetch(proxyUrl, { timeout: 10000 });
            
            if (response.ok) {
                const css = await response.text();
                if (css && css.trim().length > 10) {
                    // Convert to data URL
                    const dataUrl = `data:text/css;base64,${btoa(css)}`;
                    
                    // Create link with data URL
                    const link = document.createElement('link');
                    link.id = currentSite.styleID;
                    link.rel = 'stylesheet';
                    link.type = 'text/css';
                    link.href = dataUrl;
                    
                    document.head.appendChild(link);
                    
                    // Check if loaded
                    setTimeout(() => {
                        if (link.sheet) {
                            log('Data URL method successful!', 'success');
                            storage.setCachedCSS(css, currentSite.cssURLs[0]);
                            return true;
                        }
                        link.remove();
                        return false;
                    }, 1000);
                }
            }
        } catch (error) {
            log(`Data URL method failed: ${error.message}`, 'debug');
        }
        
        return false;
    }
    
    // 💡 METHOD 4: Standard fetch (for Claude)
    async fetchCSS(url) {
        try {
            log(`Fetching from: ${url}`, 'debug');
            
            // Try with different modes
            const modes = ['cors', 'no-cors'];
            for (const mode of modes) {
                try {
                    const response = await fetch(url, {
                        method: 'GET',
                        mode: mode,
                        cache: 'no-store',
                        headers: { 'Accept': 'text/css,*/*' }
                    });
                    
                    if (mode === 'no-cors') {
                        // Can't check status with no-cors, but can try to get text
                        const text = await response.text();
                        if (text && text.trim().length > 10) {
                            return text;
                        }
                    } else if (response.ok) {
                        return await response.text();
                    }
                } catch (modeError) {
                    log(`Fetch mode ${mode} failed: ${modeError.message}`, 'debug');
                }
            }
            
            throw new Error('All fetch modes failed');
        } catch (error) {
            throw error;
        }
    }
    
    // 💡 METHOD 5: Embedded fallback
    useEmbeddedFallback() {
        log('Using embedded CSS fallback', 'info');
        const embeddedCSS = CONFIG.EMBEDDED_CSS[window.location.hostname];
        if (embeddedCSS && this.injectStyleElement(embeddedCSS)) {
            this.currentMethod = 'embedded';
            return true;
        }
        return false;
    }
    
    // 🔧 Inject style element
    injectStyleElement(css) {
        if (!css || !css.trim()) return false;
        
        // Remove existing
        this.removeCSS();
        
        // Create new
        const style = document.createElement('style');
        style.id = currentSite.styleID;
        style.type = 'text/css';
        style.textContent = css;
        
        try {
            (document.head || document.documentElement).appendChild(style);
            this.applied = true;
            return true;
        } catch (error) {
            log(`Style injection failed: ${error.message}`, 'error');
            return false;
        }
    }
    
    // 🗑️ Remove CSS
    removeCSS() {
        const existing = document.getElementById(currentSite.styleID);
        if (existing) existing.remove();
        this.applied = false;
    }
    
    // 🔄 Check if applied
    isApplied() {
        return !!document.getElementById(currentSite.styleID);
    }
}

// 🕒 Wait for page to be ready
function waitForReady() {
    return new Promise((resolve) => {
        if (currentSite.waitForBody) {
            // For ChatGPT, wait for body
            if (document.body) {
                resolve(true);
            } else {
                const observer = new MutationObserver(() => {
                    if (document.body) {
                        observer.disconnect();
                        resolve(true);
                    }
                });
                observer.observe(document.documentElement, { childList: true });
                
                // Timeout fallback
                setTimeout(() => {
                    observer.disconnect();
                    resolve(false);
                }, 10000);
            }
        } else {
            // For Claude, proceed immediately
            resolve(true);
        }
    });
}

// 🎛️ Simple UI Controller
class UIController {
    constructor(cssManager) {
        this.cssManager = cssManager;
        this.enabled = true;
        this.button = null;
    }
    
    init() {
        this.createButton();
        this.setupEventListeners();
    }
    
    createButton() {
        this.button = document.createElement('div');
        this.button.id = 'css-styler-btn';
        this.button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            font-size: 20px;
            cursor: pointer;
            z-index: 999999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
            user-select: none;
        `;
        
        this.updateButton();
        
        this.button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
        
        // Add to page
        const addButton = () => {
            if (document.body) {
                document.body.appendChild(this.button);
            } else {
                setTimeout(addButton, 100);
            }
        };
        addButton();
    }
    
    updateButton() {
        if (!this.button) return;
        
        this.button.innerHTML = this.enabled ? '🎨' : '🚫';
        this.button.style.opacity = this.enabled ? '1' : '0.6';
        this.button.title = `${currentSite.name}: ${this.enabled ? 'ON' : 'OFF'}`;
    }
    
    toggle() {
        this.enabled = !this.enabled;
        
        if (this.enabled) {
            this.cssManager.applyCSS();
        } else {
            this.cssManager.removeCSS();
        }
        
        this.updateButton();
        this.showToast(`${currentSite.name}: ${this.enabled ? 'ON' : 'OFF'}`);
    }
    
    showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 70px;
            right: 20px;
            background: rgba(0,0,0,0.85);
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 13px;
            z-index: 999998;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: fadeIn 0.3s;
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }
    
    setupEventListeners() {
        // Reapply on page changes
        window.addEventListener('popstate', () => {
            setTimeout(() => {
                if (this.enabled && !this.cssManager.isApplied()) {
                    this.cssManager.applyCSS();
                }
            }, 500);
        });
    }
}

// 🚀 Main Application
async function main() {
    log(`Initializing CSS Styler v4.0 for ${currentSite.name}`, 'info');
    
    // Create CSS manager
    const cssManager = new CSSManager();
    
    // Wait for page to be ready
    const isReady = await waitForReady();
    if (!isReady) {
        log('Page ready check timed out', 'warning');
    }
    
    // Site-specific delay
    const delay = window.location.hostname === 'chatgpt.com' ? CONFIG.CHATGPT_DELAY : CONFIG.CLAUDE_DELAY;
    
    setTimeout(async () => {
        // Apply CSS
        const success = await cssManager.applyCSS();
        
        if (success) {
            log(`CSS applied successfully via ${cssManager.currentMethod}`, 'success');
        } else {
            log('Failed to apply CSS with all methods', 'error');
        }
        
        // Initialize UI
        const ui = new UIController(cssManager);
        ui.init();
        
    }, delay);
}

// 🏁 Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}

})();
