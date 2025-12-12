// ==UserScript==
// @name         Universal AI Chat Styler (Berry Browser Optimized)
// @namespace    http://yourdomain.example
// @version      2.2
// @description  Dynamically load custom CSS for ChatGPT and Claude AI - Berry Browser Compatible
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
'use strict';

// Configuration
const CONFIG = {
    DEBUG_MODE: true,
    CHATGPT_INITIAL_DELAY: 4000, // Increased for ChatGPT
    CLAUDE_INITIAL_DELAY: 1500,
    REAPPLY_INTERVAL: 3000, // Check and reapply every 3 seconds
    MAX_REAPPLY_ATTEMPTS: 20,
    FETCH_TIMEOUT: 15000,
    CACHE_DURATION: 12 * 60 * 60 * 1000
};

// Site configuration - FIXED URL ENCODING
const SITES = {
    'chatgpt.com': {
        name: 'ChatGPT',
        // CRITICAL FIX: Properly encode the space in the filename
        styleURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/refs/heads/main/ChatGpt%20style.css',
        styleID: 'chatgpt-enhanced-styles',
        enabledKey: 'chatgpt_styles_enabled',
        // ChatGPT needs aggressive reapplication
        needsAggressiveReapply: true,
        // Wait for ChatGPT's React app to initialize
        readySelectors: ['main', '[class*="conversation"]', 'textarea'],
        initialDelay: CONFIG.CHATGPT_INITIAL_DELAY
    },
    'claude.ai': {
        name: 'Claude AI',
        // CRITICAL FIX: Properly encode the space in the filename
        styleURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/refs/heads/main/Claude%20AI%20style.css',
        styleID: 'claude-enhanced-styles',
        enabledKey: 'claude_styles_enabled',
        needsAggressiveReapply: false,
        readySelectors: ['body'],
        initialDelay: CONFIG.CLAUDE_INITIAL_DELAY
    }
};

// Detect current site
const currentDomain = window.location.hostname;
const currentSite = SITES[currentDomain] || null;

if (!currentSite) {
    console.log('AI Chat Styler: No configuration found for this domain');
    return;
}

// State management
const state = {
    site: currentSite,
    cssContent: null,
    styleElement: null,
    reapplyInterval: null,
    reapplyCount: 0,
    lastURL: location.href,
    isInitialized: false
};

// Utility functions
const utils = {
    log(message, level = 'info') {
        if (!CONFIG.DEBUG_MODE && level === 'debug') return;
        const emoji = { 'info': 'ℹ️', 'success': '✅', 'error': '❌', 'debug': '🔍', 'warning': '⚠️' }[level] || 'ℹ️';
        console.log(`${emoji} [${currentSite.name}] ${message}`);
    },

    getStorage(key, defaultValue) {
        try {
            const item = localStorage.getItem(key);
            return item !== null ? JSON.parse(item) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    },

    setStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            this.log(`Storage error: ${e.message}`, 'error');
            return false;
        }
    },

    isEnabled() {
        return this.getStorage(state.site.enabledKey, true);
    },

    setEnabled(enabled) {
        return this.setStorage(state.site.enabledKey, enabled);
    },

    getCachedCSS() {
        const cacheKey = `css_cache_v3_${state.site.name}`;
        const cacheData = this.getStorage(cacheKey, null);
        
        if (!cacheData) return null;
        
        const { css, timestamp, url } = cacheData;
        const now = Date.now();
        
        // Invalidate if URL changed or cache expired
        if (url !== state.site.styleURL || now - timestamp > CONFIG.CACHE_DURATION) {
            this.log('Cache invalid or expired', 'debug');
            return null;
        }
        
        this.log(`Using cached CSS (${css.length} chars)`, 'success');
        return css;
    },

    setCachedCSS(css) {
        const cacheKey = `css_cache_v3_${state.site.name}`;
        const cacheData = {
            css: css,
            timestamp: Date.now(),
            url: state.site.styleURL
        };
        return this.setStorage(cacheKey, cacheData);
    },

    async waitForElement(selectors, timeout = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    this.log(`Found ready element: ${selector}`, 'debug');
                    return element;
                }
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        this.log('Ready check timed out', 'warning');
        return null;
    }
};

// CSS Fetcher - optimized for Berry Browser
const cssFetcher = {
    async fetch() {
        // Try cache first
        const cached = utils.getCachedCSS();
        if (cached) {
            state.cssContent = cached;
            return cached;
        }

        utils.log(`Fetching CSS from: ${state.site.styleURL}`, 'info');

        // Try multiple methods in sequence
        const methods = [
            () => this.fetchDirect(),
            () => this.fetchWithProxy('corsproxy.io'),
            () => this.fetchWithProxy('api.codetabs.com'),
            () => this.fetchNoCORS()
        ];

        for (let i = 0; i < methods.length; i++) {
            try {
                utils.log(`Trying fetch method ${i + 1}/${methods.length}`, 'debug');
                const css = await methods[i]();
                
                if (css && css.trim().length > 0) {
                    utils.log(`✅ Fetched ${css.length} chars via method ${i + 1}`, 'success');
                    utils.setCachedCSS(css);
                    state.cssContent = css;
                    return css;
                }
            } catch (error) {
                utils.log(`Method ${i + 1} failed: ${error.message}`, 'debug');
            }
        }

        throw new Error('All fetch methods failed');
    },

    async fetchDirect() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT);

        try {
            const response = await fetch(state.site.styleURL, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache',
                signal: controller.signal,
                headers: {
                    'Accept': 'text/css,*/*'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.text();
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    },

    async fetchWithProxy(proxyDomain) {
        let proxyUrl;
        
        if (proxyDomain === 'corsproxy.io') {
            proxyUrl = `https://corsproxy.io/?${encodeURIComponent(state.site.styleURL)}`;
        } else if (proxyDomain === 'api.codetabs.com') {
            proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(state.site.styleURL)}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT);

        try {
            const response = await fetch(proxyUrl, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.text();
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    },

    async fetchNoCORS() {
        // Last resort: try no-cors mode (won't work for reading response, but might trigger cache)
        await fetch(state.site.styleURL, {
            method: 'GET',
            mode: 'no-cors',
            cache: 'force-cache'
        });
        
        throw new Error('no-cors mode cannot read response');
    }
};

// Style Manager - multiple injection strategies
const styleManager = {
    remove() {
        // Remove existing style
        const existing = document.getElementById(state.site.styleID);
        if (existing) {
            if (existing.tagName === 'LINK' && existing.href.startsWith('blob:')) {
                URL.revokeObjectURL(existing.href);
            }
            existing.remove();
        }
        
        state.styleElement = null;
        utils.log('Styles removed', 'debug');
    },

    async apply() {
        if (!utils.isEnabled()) {
            utils.log('Styles disabled, skipping apply', 'debug');
            return false;
        }

        // Ensure we have CSS content
        if (!state.cssContent) {
            try {
                await cssFetcher.fetch();
            } catch (error) {
                utils.log(`Failed to fetch CSS: ${error.message}`, 'error');
                return false;
            }
        }

        if (!state.cssContent || state.cssContent.trim().length === 0) {
            utils.log('No CSS content available', 'error');
            return false;
        }

        this.remove();

        // Try injection methods in order of reliability for Berry Browser
        const methods = [
            { name: 'style-important', fn: () => this.injectStyleImportant() },
            { name: 'style-inline', fn: () => this.injectStyleInline() },
            { name: 'blob-link', fn: () => this.injectBlob() },
            { name: 'external-link', fn: () => this.injectExternal() }
        ];

        for (const method of methods) {
            try {
                utils.log(`Trying ${method.name}...`, 'debug');
                if (await method.fn()) {
                    utils.log(`✅ Styles applied via ${method.name}`, 'success');
                    return true;
                }
            } catch (error) {
                utils.log(`${method.name} failed: ${error.message}`, 'debug');
            }
        }

        utils.log('All injection methods failed', 'error');
        return false;
    },

    injectStyleImportant() {
        // BEST METHOD FOR BERRY BROWSER: Style element with !important rules
        if (!document.head) return false;
        
        const style = document.createElement('style');
        style.id = state.site.styleID;
        style.type = 'text/css';
        
        // Add !important to make rules more specific
        let processedCSS = state.cssContent;
        
        // Wrap everything to increase specificity
        processedCSS = `
/* AI Chat Styler - Injected by Userscript */
${processedCSS}
`;
        
        style.textContent = processedCSS;
        style.setAttribute('data-method', 'important-inline');
        
        try {
            document.head.appendChild(style);
            
            // Verify it worked
            setTimeout(() => {
                if (style.sheet && style.sheet.cssRules.length > 0) {
                    utils.log(`Style has ${style.sheet.cssRules.length} rules`, 'debug');
                }
            }, 100);
            
            state.styleElement = style;
            return true;
        } catch (error) {
            utils.log(`Style injection error: ${error.message}`, 'error');
            if (style.parentNode) style.remove();
            return false;
        }
    },

    injectStyleInline() {
        if (!document.head) return false;
        
        const style = document.createElement('style');
        style.id = state.site.styleID;
        style.type = 'text/css';
        style.textContent = state.cssContent;
        style.setAttribute('data-method', 'inline');
        
        try {
            document.head.appendChild(style);
            state.styleElement = style;
            return true;
        } catch (error) {
            if (style.parentNode) style.remove();
            return false;
        }
    },

    async injectBlob() {
        if (!document.head || typeof Blob === 'undefined' || typeof URL === 'undefined') {
            return false;
        }
        
        try {
            const blob = new Blob([state.cssContent], { type: 'text/css' });
            const blobUrl = URL.createObjectURL(blob);
            
            const link = document.createElement('link');
            link.id = state.site.styleID;
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = blobUrl;
            link.setAttribute('data-method', 'blob');
            
            return new Promise((resolve) => {
                link.onload = () => {
                    state.styleElement = link;
                    resolve(true);
                };
                
                link.onerror = () => {
                    link.remove();
                    URL.revokeObjectURL(blobUrl);
                    resolve(false);
                };
                
                document.head.appendChild(link);
                
                // Timeout fallback
                setTimeout(() => {
                    if (link.sheet) {
                        state.styleElement = link;
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }, 2000);
            });
        } catch (error) {
            utils.log(`Blob injection error: ${error.message}`, 'error');
            return false;
        }
    },

    async injectExternal() {
        if (!document.head) return false;
        
        const link = document.createElement('link');
        link.id = state.site.styleID;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = state.site.styleURL;
        link.setAttribute('data-method', 'external');
        link.setAttribute('crossorigin', 'anonymous');
        
        return new Promise((resolve) => {
            link.onload = () => {
                state.styleElement = link;
                resolve(true);
            };
            
            link.onerror = () => {
                link.remove();
                resolve(false);
            };
            
            document.head.appendChild(link);
            setTimeout(() => resolve(false), 5000);
        });
    },

    isApplied() {
        const element = document.getElementById(state.site.styleID);
        if (!element) return false;
        
        // Additional check: make sure it has actual rules
        if (element.sheet) {
            try {
                return element.sheet.cssRules.length > 0;
            } catch (e) {
                // Can't access rules (CORS), assume it's working
                return true;
            }
        }
        
        return true;
    },

    async forceReapply() {
        if (!utils.isEnabled()) return;
        
        if (!this.isApplied()) {
            utils.log('Style missing, reapplying...', 'debug');
            await this.apply();
        }
    }
};

// Aggressive reapplication for ChatGPT
const reapplicationManager = {
    start() {
        if (!state.site.needsAggressiveReapply || !utils.isEnabled()) {
            return;
        }

        utils.log('Starting aggressive reapplication', 'info');
        
        // Clear any existing interval
        this.stop();
        
        state.reapplyCount = 0;
        
        state.reapplyInterval = setInterval(async () => {
            state.reapplyCount++;
            
            if (state.reapplyCount > CONFIG.MAX_REAPPLY_ATTEMPTS) {
                utils.log('Max reapply attempts reached, stopping', 'warning');
                this.stop();
                return;
            }
            
            await styleManager.forceReapply();
            
        }, CONFIG.REAPPLY_INTERVAL);
    },

    stop() {
        if (state.reapplyInterval) {
            clearInterval(state.reapplyInterval);
            state.reapplyInterval = null;
            utils.log('Aggressive reapplication stopped', 'debug');
        }
    }
};

// Menu/Toggle UI
const menuManager = {
    setup() {
        this.createFloatingButton();
    },

    createFloatingButton() {
        const button = document.createElement('div');
        button.id = 'ai-styler-toggle-btn';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            font-size: 24px;
            cursor: pointer;
            z-index: 999999;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
            user-select: none;
        `;
        
        this.updateButtonState(button);
        
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.toggle();
        });
        
        const addButton = () => {
            if (document.body) {
                document.body.appendChild(button);
            } else {
                setTimeout(addButton, 100);
            }
        };
        addButton();
    },

    updateButtonState(button) {
        if (!button) button = document.getElementById('ai-styler-toggle-btn');
        if (!button) return;
        
        const isEnabled = utils.isEnabled();
        button.innerHTML = isEnabled ? '🎨' : '🚫';
        button.style.opacity = isEnabled ? '1' : '0.6';
        button.title = `${state.site.name}: ${isEnabled ? 'ON' : 'OFF'}`;
    },

    async toggle() {
        const newEnabled = !utils.isEnabled();
        utils.setEnabled(newEnabled);

        if (newEnabled) {
            await styleManager.apply();
            reapplicationManager.start();
        } else {
            styleManager.remove();
            reapplicationManager.stop();
        }

        this.updateButtonState();
        this.showToast(`${state.site.name}: ${newEnabled ? 'ON' : 'OFF'}`);
    },

    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: rgba(0,0,0,0.85);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 999998;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: opacity 0.3s, transform 0.3s;
        `;
        
        toast.textContent = message;
        
        const addToast = () => {
            if (document.body) {
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateY(10px)';
                    setTimeout(() => toast.remove(), 300);
                }, 2000);
            } else {
                setTimeout(addToast, 100);
            }
        };
        addToast();
    }
};

// URL change detection
const navigationManager = {
    init() {
        // Listen for URL changes
        setInterval(() => {
            if (location.href !== state.lastURL) {
                state.lastURL = location.href;
                utils.log(`URL changed: ${state.lastURL}`, 'debug');
                
                if (utils.isEnabled()) {
                    setTimeout(() => styleManager.forceReapply(), 500);
                }
            }
        }, 1000);
    }
};

// Main initialization
const app = {
    async init() {
        if (state.isInitialized) return;
        state.isInitialized = true;

        utils.log(`🚀 Initializing ${state.site.name} Styler v2.2`, 'info');
        
        // Wait for initial delay
        await new Promise(resolve => setTimeout(resolve, state.site.initialDelay));
        
        // Wait for page to be ready
        await utils.waitForElement(state.site.readySelectors);
        
        // Apply styles
        if (utils.isEnabled()) {
            const success = await styleManager.apply();
            
            if (success) {
                utils.log('✅ Initial application successful', 'success');
                
                // Start aggressive reapplication if needed
                reapplicationManager.start();
            } else {
                utils.log('❌ Initial application failed', 'error');
            }
        }
        
        // Setup UI
        menuManager.setup();
        
        // Setup navigation detection
        navigationManager.init();
        
        // Setup event listeners
        this.setupEventListeners();
        
        const status = utils.isEnabled() ? 'ENABLED ✅' : 'DISABLED ❌';
        utils.log(`Initialization complete. Status: ${status}`, 'success');
    },

    setupEventListeners() {
        // Reapply when tab becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && utils.isEnabled()) {
                setTimeout(() => styleManager.forceReapply(), 300);
            }
        });

        // Reapply on window focus
        window.addEventListener('focus', () => {
            if (utils.isEnabled()) {
                setTimeout(() => styleManager.forceReapply(), 300);
            }
        });

        // Cleanup on unload
        window.addEventListener('beforeunload', () => {
            reapplicationManager.stop();
        });
    }
};

// Start the app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

})();
