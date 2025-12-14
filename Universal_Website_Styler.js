// ==UserScript==
// @name         Universal AI Chat Styler (Berry Browser Only)
// @namespace    http://yourdomain.example
// @version      3.3
// @description  Dynamically load custom CSS for ChatGPT and Claude AI - No Grants Version
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @run-at       document-end
// ==/UserScript==

(function() {
'use strict';

// 🎯 Configuration
const CONFIG = {
    DEBUG_MODE: true,
    RETRY_DELAY: 300,
    MAX_RETRIES: 20,
    OBSERVER_THROTTLE: 500,
    CACHE_DURATION: 12 * 60 * 60 * 1000, // 12 hours
    CACHE_KEY_PREFIX: 'css_cache_berry_',
    BERRY_INITIAL_DELAY: 4000, // Increased for Berry Browser
    CHATGPT_READY_CHECK_INTERVAL: 200,
    CHATGPT_MAX_READY_CHECKS: 30
};

// 🎨 Site configuration with jsDelivr URLs
const SITES = {
    'chatgpt.com': {
        name: 'ChatGPT',
        // Primary: jsDelivr CDN URL
        styleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/ChatGpt_style.css',
        // Fallback: Direct GitHub URL (simplified)
        fallbackURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/ChatGpt_style.css',
        
        styleID: 'chatgpt-enhanced-styles',
        enabledKey: 'chatgpt_styles_enabled',
        needsReadyCheck: true,
        readySelector: 'main, [class*="conversation"], #__next',
        aggressiveReapply: true,
        cdnType: 'jsdelivr'
    },
    'claude.ai': {
        name: 'Claude AI',
        // Primary: jsDelivr CDN URL
        styleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/Claude_AI_style.css',
        // Fallback: Direct GitHub URL (simplified)
        fallbackURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/Claude_AI_style.css',
        
        styleID: 'claude-enhanced-styles',
        enabledKey: 'claude_styles_enabled',
        needsReadyCheck: false,
        readySelector: 'body',
        aggressiveReapply: false,
        cdnType: 'jsdelivr'
    }
};

// 🏗️ Detect current site
const currentDomain = window.location.hostname;
const currentSite = SITES[currentDomain] || null;

if (!currentSite) {
    console.log('AI Chat Styler: No configuration found for this domain');
    return;
}

// 📊 State management
const state = {
    site: currentSite,
    styleElement: null,
    observer: null,
    retryCount: 0,
    currentURL: location.href,
    isLoading: false,
    isBerryBrowser: true, // Always true for Berry Browser
    isReady: false,
    cssContent: null,
    appliedMethod: null,
    lastApplyTime: 0,
    cdnStatus: 'unknown',
    fetchAttempts: 0
};

// 🔍 Browser detection (simplified for Berry Browser)
(function detectBrowser() {
    const userAgent = navigator.userAgent.toLowerCase();
    console.log('🍓 Berry Browser detected - Using no-grant mode');
    console.log('User Agent:', navigator.userAgent);
    CONFIG.DEBUG_MODE = true; // Always enable debug for Berry
})();

// 🛠️ Utility functions (No GM_* dependencies)
const utils = {
    log(message, level = 'info') {
        if (!CONFIG.DEBUG_MODE && level === 'debug') return;
    
        const emoji = {
            'info': 'ℹ️',
            'success': '✅',
            'error': '❌',
            'debug': '🔍',
            'warning': '⚠️',
            'cdn': '📡',
            'berry': '🍓'
        }[level] || 'ℹ️';
    
        const prefix = `${emoji} [${currentSite.name}]`;
        console.log(`🍓 ${prefix} ${message}`);
    },

    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;

        return function(...args) {
            const context = this;
            const currentTime = Date.now();

            const execute = function() {
                lastExecTime = currentTime;
                func.apply(context, args);
            };

            clearTimeout(timeoutId);

            if (currentTime - lastExecTime > delay) {
                execute();
            } else {
                timeoutId = setTimeout(execute, delay - (currentTime - lastExecTime));
            }
        };
    },

    getValue(key, defaultValue) {
        try {
            const item = localStorage.getItem(key);
            return item !== null ? JSON.parse(item) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    },

    setValue(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            return false;
        }
    },

    getCurrentSiteEnabled() {
        return this.getValue(state.site.enabledKey, true);
    },

    setCurrentSiteEnabled(enabled) {
        return this.setValue(state.site.enabledKey, enabled);
    },

    getCachedCSS() {
        const cacheKey = CONFIG.CACHE_KEY_PREFIX + state.site.name;
        const cacheData = this.getValue(cacheKey, null);
    
        if (!cacheData) return null;
    
        const { css, timestamp, url } = cacheData;
        const now = Date.now();
    
        // Check if cache is for current URL
        if (url !== state.site.styleURL && url !== state.site.fallbackURL) {
            this.log('CSS URL changed, invalidating cache', 'warning');
            return null;
        }
    
        // Check if cache is expired
        if (now - timestamp > CONFIG.CACHE_DURATION) {
            this.log('Cache expired', 'debug');
            return null;
        }
    
        this.log(`Using cached CSS (${Math.round((now - timestamp)/60000)}min old)`, 'success');
        return css;
    },

    setCachedCSS(css) {
        const cacheKey = CONFIG.CACHE_KEY_PREFIX + state.site.name;
        const cacheData = {
            css: css,
            timestamp: Date.now(),
            url: state.site.styleURL,
            size: css.length
        };
        return this.setValue(cacheKey, cacheData);
    },

    clearCache() {
        try {
            const keys = Object.keys(localStorage).filter(k => k.startsWith(CONFIG.CACHE_KEY_PREFIX));
            keys.forEach(k => localStorage.removeItem(k));
            this.log(`Cleared ${keys.length} cache entries`, 'success');
            return keys.length;
        } catch (e) {
            return 0;
        }
    },

    async waitForElement(selector, timeout = 10000) {
        const startTime = Date.now();
    
        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element) {
                return element;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    
        this.log(`Timeout waiting for: ${selector}`, 'warning');
        return null;
    },

    async waitForPageReady() {
        if (!state.site.needsReadyCheck) {
            return true;
        }

        this.log('Waiting for page to be ready...', 'debug');
    
        const element = await this.waitForElement(state.site.readySelector, 10000);
    
        if (element) {
            this.log('Page is ready', 'success');
        
            // Extra delay for Berry Browser
            if (currentDomain === 'chatgpt.com') {
                this.log('Applying ChatGPT Berry Browser delay...', 'debug');
                await new Promise(resolve => setTimeout(resolve, CONFIG.BERRY_INITIAL_DELAY));
            }
        
            return true;
        }
    
        this.log('Page ready check timed out, continuing anyway', 'warning');
        return false;
    }
};

// 📥 CSS loader - Optimized for Berry Browser (No GM_*)
const cssLoader = {
    async fetchExternalCSS() {
        state.fetchAttempts++;
        
        // 1. Check cache first
        const cachedCSS = utils.getCachedCSS();
        if (cachedCSS) {
            state.cssContent = cachedCSS;
            return cachedCSS;
        }

        utils.log(`Fetch attempt #${state.fetchAttempts} for ${state.site.name}`, 'info');
        utils.log(`Primary CDN: ${state.site.styleURL}`, 'cdn');
        
        // 2. Start with jsDelivr - Berry Browser optimized
        return await this.fetchForBerryBrowser();
    },

    // 🍓 Specialized fetch for Berry Browser
    async fetchForBerryBrowser() {
        utils.log('Berry: Starting optimized fetch sequence...', 'berry');
        
        // Strategy 1: Try jsDelivr with no-cors first (most likely to work)
        utils.log('Berry: Trying jsDelivr with no-cors mode...', 'debug');
        try {
            const response = await fetch(state.site.styleURL, {
                method: 'GET',
                mode: 'no-cors',
                cache: 'reload'
            });
            
            const css = await response.text();
            
            if (css && css.trim().length > 10) {
                utils.log(`Berry (no-cors): Got ${css.length} chars from jsDelivr`, 'success');
                utils.setCachedCSS(css);
                state.cssContent = css;
                state.cdnStatus = 'jsdelivr_no_cors';
                return css;
            }
        } catch (noCorsError) {
            utils.log(`Berry (no-cors) failed: ${noCorsError.message}`, 'debug');
        }
        
        // Strategy 2: Try jsDelivr with cors mode
        utils.log('Berry: Trying jsDelivr with cors mode...', 'debug');
        try {
            const response = await fetch(state.site.styleURL, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache'
            });
            
            if (response.ok) {
                const css = await response.text();
                if (css && css.trim().length > 0) {
                    utils.log(`Berry (cors): Fetched ${css.length} chars from jsDelivr`, 'success');
                    utils.setCachedCSS(css);
                    state.cssContent = css;
                    state.cdnStatus = 'jsdelivr_cors';
                    return css;
                }
            }
        } catch (corsError) {
            utils.log(`Berry (cors) failed: ${corsError.message}`, 'debug');
        }
        
        // Strategy 3: Try GitHub fallback with no-cors
        utils.log('Berry: Trying GitHub fallback...', 'berry');
        try {
            const response = await fetch(state.site.fallbackURL, {
                method: 'GET',
                mode: 'no-cors',
                cache: 'reload'
            });
            
            const css = await response.text();
            if (css && css.trim().length > 10) {
                utils.log(`Berry: Got ${css.length} chars from GitHub fallback`, 'success');
                utils.setCachedCSS(css);
                state.cssContent = css;
                state.cdnStatus = 'github_fallback';
                return css;
            }
        } catch (githubError) {
            utils.log(`Berry GitHub fallback failed: ${githubError.message}`, 'debug');
        }
        
        // Strategy 4: Try CORS proxies as last resort
        utils.log('Berry: Trying CORS proxies...', 'berry');
        try {
            const css = await this.fetchViaCORSProxy();
            utils.setCachedCSS(css);
            state.cssContent = css;
            state.cdnStatus = 'cors_proxy';
            return css;
        } catch (proxyError) {
            utils.log(`Berry CORS proxy failed: ${proxyError.message}`, 'error');
        }
        
        throw new Error('Berry Browser: All fetch methods failed');
    },

    // CORS proxy method
    async fetchViaCORSProxy() {
        utils.log('Trying CORS proxies...', 'debug');
        
        const proxies = [
            `https://corsproxy.io/?${encodeURIComponent(state.site.styleURL)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(state.site.styleURL)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(state.site.styleURL)}`
        ];
        
        for (let i = 0; i < proxies.length; i++) {
            const proxyUrl = proxies[i];
            try {
                utils.log(`Proxy ${i + 1}/${proxies.length}`, 'debug');
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: { 'Accept': 'text/css,*/*' },
                    signal: controller.signal,
                    mode: 'cors',
                    cache: 'no-cache'
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const css = await response.text();
                
                if (css && css.trim().length > 0) {
                    utils.log(`Fetched ${css.length} chars via proxy`, 'success');
                    return css;
                }
            } catch (error) {
                utils.log(`Proxy ${i + 1} failed: ${error.message}`, 'debug');
                continue;
            }
        }
        
        throw new Error('All CORS proxies failed');
    }
};

// 🎨 Style manager
const styleManager = {
    async apply() {
        if (!utils.getCurrentSiteEnabled() || state.isLoading) {
            return false;
        }

        const now = Date.now();
        if (now - state.lastApplyTime < 500) {
            utils.log('Throttling apply attempt', 'debug');
            return false;
        }
        state.lastApplyTime = now;

        this.remove();
        state.isLoading = true;

        try {
            await utils.waitForPageReady();
        
            if (!state.cssContent) {
                utils.log('Fetching CSS...', 'info');
                await cssLoader.fetchExternalCSS();
            }

            if (!state.cssContent || state.cssContent.trim().length === 0) {
                throw new Error('No CSS content available');
            }

            // Try injection methods
            const methods = [
                { name: 'style-element', fn: () => this.injectViaStyle() },
                { name: 'blob-link', fn: () => this.injectViaBlob() }
            ];

            for (const method of methods) {
                try {
                    utils.log(`Trying ${method.name}...`, 'debug');
                    if (await method.fn()) {
                        state.appliedMethod = method.name;
                        utils.log(`✅ Styles applied via ${method.name}`, 'success');
                        state.isLoading = false;
                        return true;
                    }
                } catch (error) {
                    utils.log(`${method.name} failed: ${error.message}`, 'debug');
                }
            }
        
            throw new Error('All injection methods failed');
        
        } catch (error) {
            utils.log(`Failed to apply styles: ${error.message}`, 'error');
            state.isLoading = false;
            return false;
        }
    },

    // Method 1: Inline style element (most reliable)
    injectViaStyle() {
        if (!document.head) return false;
    
        const style = document.createElement('style');
        style.id = state.site.styleID;
        style.type = 'text/css';
        style.textContent = state.cssContent;
        style.setAttribute('data-cdn', state.cdnStatus);
    
        try {
            document.head.appendChild(style);
            state.styleElement = style;
            return true;
        } catch (error) {
            style.remove();
            return false;
        }
    },

    // Method 2: Blob URL
    async injectViaBlob() {
        if (!document.head) return false;
    
        const blob = new Blob([state.cssContent], { type: 'text/css' });
        const blobUrl = URL.createObjectURL(blob);
    
        const link = document.createElement('link');
        link.id = state.site.styleID;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = blobUrl;
        link.setAttribute('data-cdn', state.cdnStatus);
    
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
        
            // Fallback timeout
            setTimeout(() => {
                if (link.sheet) {
                    state.styleElement = link;
                    resolve(true);
                } else {
                    resolve(false);
                }
            }, 1000);
        });
    },

    remove() {
        const existingStyle = document.getElementById(state.site.styleID);
        if (existingStyle) {
            if (existingStyle.tagName === 'LINK' && existingStyle.href.startsWith('blob:')) {
                URL.revokeObjectURL(existingStyle.href);
            }
            existingStyle.remove();
            utils.log('Styles removed', 'debug');
        }
    
        state.styleElement = null;
    },

    isApplied() {
        return !!document.getElementById(state.site.styleID);
    },

    async forceReapply() {
        if (utils.getCurrentSiteEnabled() && !this.isApplied()) {
            utils.log('Force reapplying styles', 'debug');
            await this.apply();
        }
    }
};

// 👁️ Observer manager
const observerManager = {
    setup() {
        this.cleanup();
        if (!utils.getCurrentSiteEnabled()) return;

        if (state.site.aggressiveReapply) {
            this.createAggressiveObserver();
        } else {
            this.createStandardObserver();
        }
    
        utils.log('Observer started', 'debug');
    },

    createStandardObserver() {
        const throttledReapply = utils.throttle(() => {
            styleManager.forceReapply();
        }, CONFIG.OBSERVER_THROTTLE);

        state.observer = new MutationObserver(mutations => {
            let shouldReapply = false;

            for (const mutation of mutations) {
                if (mutation.removedNodes.length > 0) {
                    for (const node of mutation.removedNodes) {
                        if (node.id === state.site.styleID) {
                            shouldReapply = true;
                            break;
                        }
                    }
                }
            }

            if (shouldReapply) {
                throttledReapply();
            }
        });

        state.observer.observe(document.head, {
            childList: true,
            subtree: false
        });
    },

    createAggressiveObserver() {
        let checkCount = 0;
        const maxChecks = 50;
    
        const checkAndReapply = async () => {
            if (checkCount++ > maxChecks) {
                clearInterval(intervalId);
                utils.log('Aggressive observer stopped after max checks', 'debug');
                return;
            }
        
            if (!styleManager.isApplied() && utils.getCurrentSiteEnabled()) {
                utils.log('Style missing, reapplying...', 'debug');
                await styleManager.forceReapply();
            }
        };
    
        const intervalId = setInterval(checkAndReapply, 2000);
    
        state.observer = {
            disconnect: () => clearInterval(intervalId)
        };
    },

    cleanup() {
        if (state.observer) {
            if (state.observer.disconnect) {
                state.observer.disconnect();
            }
            state.observer = null;
        }
    }
};

// 📱 Floating button manager
const buttonManager = {
    setup() {
        this.createFloatingButton();
    },

    createFloatingButton() {
        const button = document.createElement('div');
        button.id = 'ai-styler-btn';
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
            -webkit-tap-highlight-color: transparent;
        `;
    
        this.updateButtonState(button);
    
        // Click: Toggle styles
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.toggleCurrentSiteStyles();
        });
    
        // Long press: Show debug info
        let longPressTimer;
        button.addEventListener('touchstart', (e) => {
            longPressTimer = setTimeout(() => {
                this.showDebugInfo();
            }, 1500);
        });
        
        button.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
        });
        
        // Mouse long press for testing
        button.addEventListener('mousedown', (e) => {
            longPressTimer = setTimeout(() => {
                this.showDebugInfo();
            }, 1500);
        });
        
        button.addEventListener('mouseup', () => {
            clearTimeout(longPressTimer);
        });
        button.addEventListener('mouseleave', () => {
            clearTimeout(longPressTimer);
        });
    
        const addButton = () => {
            if (document.body) {
                document.body.appendChild(button);
                this.addPulseAnimation();
            } else {
                setTimeout(addButton, 100);
            }
        };
        addButton();
    },

    updateButtonState(button) {
        if (!button) button = document.getElementById('ai-styler-btn');
        if (!button) return;
    
        const isEnabled = utils.getCurrentSiteEnabled();
        button.innerHTML = isEnabled ? '🎨' : '🚫';
        button.style.opacity = isEnabled ? '1' : '0.6';
        button.title = `${state.site.name}: ${isEnabled ? 'ON' : 'OFF'} | CDN: ${state.cdnStatus}`;
        
        // Pulse animation when loading
        if (state.isLoading) {
            button.style.animation = 'pulse 1.5s infinite';
        } else {
            button.style.animation = 'none';
        }
    },

    toggleCurrentSiteStyles() {
        const newEnabled = !utils.getCurrentSiteEnabled();
        utils.setCurrentSiteEnabled(newEnabled);

        if (newEnabled) {
            styleManager.apply();
            observerManager.setup();
        } else {
            styleManager.remove();
            observerManager.cleanup();
        }

        this.updateButtonState();
        this.showToast(`${state.site.name}: ${newEnabled ? 'ON' : 'OFF'}`);
    },

    showDebugInfo() {
        const info = `
🍓 Berry Browser Debug Info:
============================
Site: ${state.site.name}
URL: ${window.location.href}
CDN Status: ${state.cdnStatus}
CDN URL: ${state.site.styleURL}
Fetch Attempts: ${state.fetchAttempts}
CSS Loaded: ${state.cssContent ? state.cssContent.length + ' chars' : 'No'}
Style Applied: ${styleManager.isApplied()}
Applied Method: ${state.appliedMethod || 'None'}
Cache: ${utils.getValue(CONFIG.CACHE_KEY_PREFIX + state.site.name, null) ? 'Yes' : 'No'}
User Agent: ${navigator.userAgent}
============================
        `.trim();
        
        console.log(info);
        this.showToast('Debug info in console');
    },

    clearCache() {
        const cleared = utils.clearCache();
        this.showToast(`Cleared ${cleared} cache entries`);
        
        // Force reload CSS
        if (utils.getCurrentSiteEnabled()) {
            state.cssContent = null;
            setTimeout(() => styleManager.forceReapply(), 500);
        }
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
            animation: slideIn 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
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
    },

    addPulseAnimation() {
        if (!document.head) return;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
                50% { transform: scale(1.1); box-shadow: 0 6px 20px rgba(0,0,0,0.4); }
                100% { transform: scale(1); box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
            }
            @keyframes slideIn {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
};

// 🧭 Navigation manager
const navigationManager = {
    init() {
        window.addEventListener('popstate', this.handleURLChange);
        window.addEventListener('hashchange', this.handleURLChange);
    },

    handleURLChange: utils.throttle(() => {
        if (location.href !== state.currentURL) {
            state.currentURL = location.href;
            utils.log(`URL changed: ${state.currentURL}`, 'debug');
        
            if (utils.getCurrentSiteEnabled()) {
                setTimeout(() => styleManager.forceReapply(), 300);
            }
        }
    }, 500)
};

// 🚀 Main application
const app = {
    async init() {
        utils.log(`🚀 Initializing ${state.site.name} Styler v3.3 (Berry Browser)`, 'info');
        utils.log(`Primary CDN: jsDelivr`, 'cdn');
    
        // Initial delay for Berry Browser
        const initialDelay = 2000;
    
        setTimeout(async () => {
            await this.applyWithRetry();
            observerManager.setup();
            buttonManager.setup();
            navigationManager.init();
            this.setupEventListeners();
        
            const status = utils.getCurrentSiteEnabled() ? 'ENABLED ✅' : 'DISABLED ❌';
            utils.log(`Initialization complete. Status: ${status}`, 'success');
        }, initialDelay);
    },

    async applyWithRetry() {
        if (!utils.getCurrentSiteEnabled()) return;

        for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
            try {
                utils.log(`Apply attempt ${attempt}/${CONFIG.MAX_RETRIES}`, 'debug');
            
                if (await styleManager.apply()) {
                    utils.log('Styles successfully applied!', 'success');
                    buttonManager.updateButtonState();
                    return;
                }
            } catch (error) {
                utils.log(`Attempt ${attempt} error: ${error.message}`, 'error');
            }

            if (attempt < CONFIG.MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
            }
        }
    
        utils.log('Max retries reached - styles may not be applied', 'warning');
    },

    setupEventListeners() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && utils.getCurrentSiteEnabled()) {
                setTimeout(() => styleManager.forceReapply(), 200);
            }
        });

        window.addEventListener('beforeunload', () => {
            observerManager.cleanup();
        });
    }
};

// 🏁 Start the application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

})();
