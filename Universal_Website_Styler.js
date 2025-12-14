// ==UserScript==
// @name         Universal AI Chat Styler (Berry Browser Enhanced)
// @namespace    http://yourdomain.example
// @version      4.0
// @description  Load custom CSS for ChatGPT and Claude AI - Berry Browser Optimized with Enhanced Fetch
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// ==/UserScript==

(function() {
'use strict';

// 🎯 Configuration
const CONFIG = {
    DEBUG_MODE: true,
    RETRY_DELAY: 500,
    MAX_RETRIES: 15,
    OBSERVER_THROTTLE: 500,
    CACHE_DURATION: 12 * 60 * 60 * 1000, // 12 hours
    CACHE_KEY_PREFIX: 'css_cache_v4_',
    BERRY_INITIAL_DELAY: 3000,
    FETCH_TIMEOUT: 20000
};

// 🎨 Site configuration with multiple URL sources
const SITES = {
    'chatgpt.com': {
        name: 'ChatGPT',
        // Multiple sources for better reliability
        styleURLs: [
            'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/ChatGpt_style.css',
            'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/ChatGpt_style.css',
            'https://gist.githubusercontent.com/yfjuu4/YOUR_GIST_ID/raw/ChatGpt_style.css' // Add as backup
        ],
        styleID: 'chatgpt-enhanced-styles',
        needsReadyCheck: true,
        readySelector: 'main, [class*="conversation"], #__next',
        aggressiveReapply: true,
        earlyInject: true // Try to inject before page is fully loaded
    },
    'claude.ai': {
        name: 'Claude AI',
        styleURLs: [
            'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/Claude_AI_style.css',
            'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/Claude_AI_style.css'
        ],
        styleID: 'claude-enhanced-styles',
        needsReadyCheck: false,
        readySelector: 'body',
        aggressiveReapply: false,
        earlyInject: false
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
    currentURL: location.href,
    isLoading: false,
    hasGrants: false,
    isBerryBrowser: false,
    cssContent: null,
    appliedMethod: null,
    lastApplyTime: 0,
    fetchAttempts: 0,
    enabled: true,
    fetchQueue: [],
    isEarlyPhase: true
};

// 🔍 Browser detection
(function detectCapabilities() {
    state.hasGrants = typeof GM_xmlhttpRequest !== 'undefined';
    
    const userAgent = navigator.userAgent.toLowerCase();
    state.isBerryBrowser = !state.hasGrants && /android/.test(userAgent);
    
    if (state.isBerryBrowser) {
        console.log('🍓 Berry Browser detected - using enhanced fallback methods');
        CONFIG.DEBUG_MODE = true;
    }
})();

// 🛠️ Utility functions
const utils = {
    log(message, level = 'info') {
        if (!CONFIG.DEBUG_MODE && level === 'debug') return;
        
        const emoji = {
            'info': 'ℹ️',
            'success': '✅',
            'error': '❌',
            'debug': '🔍',
            'warning': '⚠️',
            'berry': '🍓'
        }[level] || 'ℹ️';
        
        const prefix = state.isBerryBrowser ? `${emoji}🍓` : emoji;
        console.log(`${prefix} [${currentSite.name}] ${message}`);
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
    
    getCachedCSS() {
        const cacheKey = CONFIG.CACHE_KEY_PREFIX + state.site.name;
        const cacheData = this.getValue(cacheKey, null);
    
        if (!cacheData) return null;
    
        const { css, timestamp, url } = cacheData;
        const now = Date.now();
    
        // Check if cache is expired
        if (now - timestamp > CONFIG.CACHE_DURATION) {
            this.log('Cache expired', 'debug');
            return null;
        }
    
        this.log(`Using cached CSS (${Math.round((now - timestamp)/60000)}min old)`, 'debug');
        return css;
    },
    
    setCachedCSS(css) {
        const cacheKey = CONFIG.CACHE_KEY_PREFIX + state.site.name;
        const cacheData = {
            css: css,
            timestamp: Date.now(),
            url: state.site.styleURLs[0]
        };
        return this.setValue(cacheKey, cacheData);
    },
    
    clearCache() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(CONFIG.CACHE_KEY_PREFIX));
        keys.forEach(k => localStorage.removeItem(k));
        this.log(`Cleared ${keys.length} cache entries`, 'success');
        return keys.length;
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
        
            // Extra delay for Berry Browser on ChatGPT
            if (state.isBerryBrowser && currentDomain === 'chatgpt.com') {
                this.log('Applying ChatGPT Berry Browser delay...', 'debug');
                await new Promise(resolve => setTimeout(resolve, CONFIG.BERRY_INITIAL_DELAY));
            }
        
            return true;
        }
    
        this.log('Page ready check timed out, continuing anyway', 'warning');
        return false;
    },
    
    // Create a timeout wrapper for fetch
    fetchWithTimeout(url, options = {}, timeout = CONFIG.FETCH_TIMEOUT) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Fetch timeout')), timeout)
            )
        ]);
    }
};

// 📥 Enhanced CSS loader for Berry Browser
const cssLoader = {
    async fetchExternalCSS() {
        state.fetchAttempts++;
        
        // 1. Check cache first
        const cachedCSS = utils.getCachedCSS();
        if (cachedCSS) {
            state.cssContent = cachedCSS;
            return cachedCSS;
        }

        utils.log(`Fetch attempt #${state.fetchAttempts}`, 'info');
        
        // 2. Try GM_xmlhttpRequest if available (Tampermonkey)
        if (state.hasGrants) {
            try {
                const css = await this.fetchViaGM();
                utils.setCachedCSS(css);
                state.cssContent = css;
                return css;
            } catch (error) {
                utils.log(`GM fetch failed: ${error.message}`, 'error');
            }
        }
        
        // 3. BERRY BROWSER: Enhanced multi-strategy approach
        if (state.isBerryBrowser || !state.hasGrants) {
            try {
                const css = await this.fetchForBerryBrowser();
                if (css) {
                    utils.setCachedCSS(css);
                    state.cssContent = css;
                    return css;
                }
            } catch (berryError) {
                utils.log(`Berry fetch failed: ${berryError.message}`, 'error');
            }
        }
        
        throw new Error(`Could not fetch CSS from any source`);
    },
    
    // Method 1: GM_xmlhttpRequest (Tampermonkey only)
    fetchViaGM() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const tryFetch = () => {
                if (attempts >= state.site.styleURLs.length) {
                    reject(new Error('All GM sources failed'));
                    return;
                }
                
                const url = state.site.styleURLs[attempts];
                attempts++;
                
                utils.log(`GM trying: ${url}`, 'debug');
                
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    timeout: CONFIG.FETCH_TIMEOUT,
                    headers: {
                        'Accept': 'text/css,*/*',
                        'Cache-Control': 'no-cache'
                    },
                    onload: (response) => {
                        if (response.status >= 200 && response.status < 300) {
                            const css = response.responseText;
                            if (css && css.trim().length > 10) {
                                utils.log(`GM success: ${css.length} chars from source ${attempts}`, 'success');
                                resolve(css);
                            } else {
                                utils.log(`GM empty response from source ${attempts}`, 'warning');
                                tryFetch();
                            }
                        } else {
                            utils.log(`GM HTTP ${response.status} from source ${attempts}`, 'warning');
                            tryFetch();
                        }
                    },
                    onerror: () => {
                        utils.log(`GM network error from source ${attempts}`, 'warning');
                        tryFetch();
                    },
                    ontimeout: () => {
                        utils.log(`GM timeout from source ${attempts}`, 'warning');
                        tryFetch();
                    }
                });
            };
            
            tryFetch();
        });
    },
    
    // Method 2: Berry Browser enhanced multi-strategy fetch
    async fetchForBerryBrowser() {
        utils.log('Berry: Starting enhanced fetch sequence...', 'berry');
        
        // Strategy 1: Try all source URLs with different fetch configurations
        const fetchStrategies = [];
        
        for (const url of state.site.styleURLs) {
            // Try each URL with multiple strategies
            fetchStrategies.push(
                { url, mode: 'cors', cache: 'no-store', desc: 'CORS' },
                { url, mode: 'no-cors', cache: 'no-store', desc: 'no-CORS' },
                { url, mode: 'cors', cache: 'default', desc: 'CORS cached' }
            );
        }
        
        // Try each strategy
        for (const strategy of fetchStrategies) {
            utils.log(`Berry: Trying ${strategy.desc} on ${strategy.url.split('/').pop()}`, 'debug');
            
            try {
                const response = await utils.fetchWithTimeout(strategy.url, {
                    method: 'GET',
                    mode: strategy.mode,
                    cache: strategy.cache,
                    credentials: 'omit',
                    redirect: 'follow'
                });
                
                // For no-cors mode, we can't check status, but we can try to read
                const css = await response.text();
                
                if (css && css.trim().length > 10 && !css.includes('<!DOCTYPE')) {
                    utils.log(`Berry success (${strategy.desc}): ${css.length} chars`, 'success');
                    return css;
                }
            } catch (error) {
                utils.log(`Berry (${strategy.desc}) failed: ${error.message}`, 'debug');
            }
        }
        
        // Strategy 2: Try CORS proxies as last resort
        utils.log('Berry: Trying CORS proxies...', 'debug');
        
        const proxies = [
            `https://api.allorigins.win/raw?url=`,
            `https://corsproxy.io/?`,
            `https://api.codetabs.com/v1/proxy?quest=`
        ];
        
        for (const proxyBase of proxies) {
            for (const url of state.site.styleURLs) {
                const proxyUrl = proxyBase + encodeURIComponent(url);
                
                try {
                    utils.log(`Berry: Trying proxy for ${url.split('/').pop()}`, 'debug');
                    
                    const response = await utils.fetchWithTimeout(proxyUrl, {
                        method: 'GET',
                        cache: 'no-store'
                    });
                    
                    if (response.ok) {
                        const css = await response.text();
                        
                        if (css && css.trim().length > 10) {
                            utils.log(`Berry proxy success: ${css.length} chars`, 'success');
                            return css;
                        }
                    }
                } catch (error) {
                    utils.log(`Berry proxy failed: ${error.message}`, 'debug');
                }
            }
        }
        
        // Strategy 3: Try creating an iframe to bypass CSP (advanced technique)
        if (currentDomain === 'chatgpt.com') {
            utils.log('Berry: Trying iframe bypass method...', 'debug');
            try {
                const css = await this.fetchViaIframe();
                if (css) {
                    utils.log(`Berry iframe success: ${css.length} chars`, 'success');
                    return css;
                }
            } catch (error) {
                utils.log(`Berry iframe failed: ${error.message}`, 'debug');
            }
        }
        
        throw new Error('All Berry strategies exhausted');
    },
    
    // Strategy 4: Iframe-based fetch (bypasses some CSP restrictions)
    fetchViaIframe() {
        return new Promise((resolve, reject) => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.sandbox = 'allow-same-origin allow-scripts';
            
            const timeout = setTimeout(() => {
                iframe.remove();
                reject(new Error('Iframe timeout'));
            }, CONFIG.FETCH_TIMEOUT);
            
            iframe.onload = async () => {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    
                    // Try to fetch from within iframe context
                    const url = state.site.styleURLs[0];
                    const response = await iframe.contentWindow.fetch(url, {
                        mode: 'cors',
                        cache: 'no-store'
                    });
                    
                    const css = await response.text();
                    
                    clearTimeout(timeout);
                    iframe.remove();
                    
                    if (css && css.trim().length > 10) {
                        resolve(css);
                    } else {
                        reject(new Error('Empty iframe response'));
                    }
                } catch (error) {
                    clearTimeout(timeout);
                    iframe.remove();
                    reject(error);
                }
            };
            
            iframe.onerror = () => {
                clearTimeout(timeout);
                iframe.remove();
                reject(new Error('Iframe load error'));
            };
            
            // Use about:blank to create a clean context
            iframe.src = 'about:blank';
            document.documentElement.appendChild(iframe);
        });
    }
};

// 🎨 Style manager
const styleManager = {
    async apply() {
        if (!state.enabled || state.isLoading) {
            return false;
        }

        const now = Date.now();
        if (now - state.lastApplyTime < 300) {
            utils.log('Throttling apply attempt', 'debug');
            return false;
        }
        state.lastApplyTime = now;

        this.remove();
        state.isLoading = true;

        try {
            // For ChatGPT in Berry, try early injection
            if (state.site.earlyInject && state.isEarlyPhase) {
                utils.log('Attempting early injection', 'debug');
            } else {
                await utils.waitForPageReady();
            }
        
            if (!state.cssContent) {
                utils.log('Fetching CSS...', 'info');
                await cssLoader.fetchExternalCSS();
            }

            if (!state.cssContent || state.cssContent.trim().length === 0) {
                throw new Error('No CSS content available');
            }

            // Try injection methods in order of reliability
            const methods = [
                () => this.injectViaStyle(),
                () => this.injectViaBlob(),
                () => this.injectViaDataURI()
            ];
            
            for (const method of methods) {
                if (await method()) {
                    state.appliedMethod = method.name;
                    utils.log(`✅ Styles applied via ${method.name}`, 'success');
                    state.isLoading = false;
                    return true;
                }
            }
        
            throw new Error('All injection methods failed');
        
        } catch (error) {
            utils.log(`Failed to apply styles: ${error.message}`, 'error');
            state.isLoading = false;
            return false;
        }
    },
    
    async injectViaBlob() {
        if (!document.head) return false;
    
        try {
            const blob = new Blob([state.cssContent], { type: 'text/css' });
            const blobUrl = URL.createObjectURL(blob);
        
            const link = document.createElement('link');
            link.id = state.site.styleID;
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = blobUrl;
        
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
        } catch (error) {
            return false;
        }
    },
    
    injectViaStyle() {
        if (!document.head) return false;
    
        try {
            const style = document.createElement('style');
            style.id = state.site.styleID;
            style.type = 'text/css';
            style.textContent = state.cssContent;
        
            document.head.appendChild(style);
            state.styleElement = style;
            return true;
        } catch (error) {
            return false;
        }
    },
    
    injectViaDataURI() {
        if (!document.head) return false;
    
        try {
            const dataURI = 'data:text/css;charset=utf-8,' + encodeURIComponent(state.cssContent);
        
            const link = document.createElement('link');
            link.id = state.site.styleID;
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = dataURI;
        
            document.head.appendChild(link);
            state.styleElement = link;
            return true;
        } catch (error) {
            return false;
        }
    },
    
    remove() {
        const existingStyle = document.getElementById(state.site.styleID);
        if (existingStyle) {
            if (existingStyle.tagName === 'LINK' && existingStyle.href.startsWith('blob:')) {
                URL.revokeObjectURL(existingStyle.href);
            }
            existingStyle.remove();
        }
    
        state.styleElement = null;
        utils.log('Styles removed', 'debug');
    },
    
    isApplied() {
        return !!document.getElementById(state.site.styleID);
    },
    
    async forceReapply() {
        if (state.enabled && !this.isApplied()) {
            utils.log('Force reapplying styles', 'debug');
            await this.apply();
        }
    }
};

// 👁️ Observer manager
const observerManager = {
    setup() {
        this.cleanup();
        if (!state.enabled) return;

        if (state.site.aggressiveReapply || state.isBerryBrowser) {
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
        const maxChecks = 60;
    
        const checkAndReapply = async () => {
            if (checkCount++ > maxChecks) {
                clearInterval(intervalId);
                utils.log('Aggressive observer stopped', 'debug');
                return;
            }
        
            if (!styleManager.isApplied() && state.enabled) {
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

// 📱 UI manager
const uiManager = {
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
    
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.toggleStyles();
        });
    
        if (state.isBerryBrowser) {
            let longPressTimer;
            button.addEventListener('touchstart', (e) => {
                longPressTimer = setTimeout(() => {
                    this.showDebugInfo();
                }, 1500);
            });
            
            button.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
            });
        }
    
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
        if (!button) button = document.getElementById('ai-styler-btn');
        if (!button) return;
    
        button.innerHTML = state.enabled ? '🎨' : '🚫';
        button.style.opacity = state.enabled ? '1' : '0.6';
        button.title = `${state.site.name}: ${state.enabled ? 'ON' : 'OFF'}`;
        
        if (state.isLoading) {
            button.style.animation = 'pulse 1.5s infinite';
        } else {
            button.style.animation = 'none';
        }
    },
    
    toggleStyles() {
        state.enabled = !state.enabled;
        
        if (state.enabled) {
            styleManager.apply();
            observerManager.setup();
        } else {
            styleManager.remove();
            observerManager.cleanup();
        }
        
        this.updateButtonState();
        this.showToast(`${state.site.name}: ${state.enabled ? 'ON' : 'OFF'}`);
    },
    
    showDebugInfo() {
        const info = `
🍓 Berry Browser Debug Info:
Site: ${state.site.name}
Primary URL: ${state.site.styleURLs[0]}
Enabled: ${state.enabled}
Fetch Attempts: ${state.fetchAttempts}
CSS Content: ${state.cssContent ? state.cssContent.length + ' chars' : 'None'}
Applied Method: ${state.appliedMethod || 'None'}
Style Applied: ${styleManager.isApplied()}
Has Grants: ${state.hasGrants}
Is Berry: ${state.isBerryBrowser}
User Agent: ${navigator.userAgent}
        `.trim();
        
        console.log(info);
        this.showToast('Debug info logged to console');
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
    
        if (document.body) {
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px)';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
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
        
            if (state.enabled) {
                setTimeout(() => styleManager.forceReapply(), 300);
            }
        }
    }, 500)
};

// 🚀 Main application
const app = {
    async init() {
        utils.log(`🚀 Initializing ${state.site.name} Styler v4.0`, 'info');
        utils.log(`Mode: ${state.isBerryBrowser ? '🍓 Berry Browser' : 'Standard'}`, 'info');
        utils.log(`Has GM grants: ${state.hasGrants}`, 'debug');
    
        // Add CSS animations
        this.addPulseAnimation();
    
        // For ChatGPT in Berry Browser, try immediate early injection
        if (state.isBerryBrowser && currentDomain === 'chatgpt.com') {
            utils.log('Attempting immediate early fetch for ChatGPT...', 'berry');
            this.earlyFetchAttempt();
        }
    
        // Regular initialization
        const initialDelay = state.isBerryBrowser ? 1500 : 500;
    
        setTimeout(async () => {
            state.isEarlyPhase = false;
            await this.applyWithRetry();
            observerManager.setup();
            uiManager.setup();
            navigationManager.init();
            this.setupEventListeners();
        
            utils.log(`Initialization complete. Status: ${state.enabled ? 'ENABLED ✅' : 'DISABLED ❌'}`, 'success');
        }, initialDelay);
    },
    
    // Try to fetch CSS as early as possible
    async earlyFetchAttempt() {
        try {
            utils.log('Early fetch starting...', 'debug');
            await cssLoader.fetchExternalCSS();
            utils.log('Early fetch successful!', 'success');
            
            // Try to apply immediately if document.head exists
            if (document.head) {
                await styleManager.apply();
            }
        } catch (error) {
            utils.log(`Early fetch failed: ${error.message}`, 'debug');
            // Will retry in main initialization
        }
    },
    
    async applyWithRetry() {
        if (!state.enabled) return;

        for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
            try {
                utils.log(`Apply attempt ${attempt}/${CONFIG.MAX_RETRIES}`, 'debug');
            
                if (await styleManager.apply()) {
                    utils.log('Styles successfully applied!', 'success');
                    return;
                }
            } catch (error) {
                utils.log(`Attempt ${attempt} error: ${error.message}`, 'error');
            }

            if (attempt < CONFIG.MAX_RETRIES) {
                const delay = CONFIG.RETRY_DELAY * Math.min(attempt, 3);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    
        utils.log('Max retries reached - CSS fetch may have failed', 'warning');
        
        // Show error toast for user
        if (state.isBerryBrowser) {
            uiManager.showToast('⚠️ Failed to load styles. Check console for details.');
        }
    },
    
    setupEventListeners() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && state.enabled) {
                setTimeout(() => styleManager.forceReapply(), 200);
            }
        });

        window.addEventListener('focus', () => {
            if (state.enabled) {
                setTimeout(() => styleManager.forceReapply(), 200);
            }
        });

        window.addEventListener('beforeunload', () => {
            observerManager.cleanup();
        });
        
        // Listen for fetch errors globally (for debugging)
        if (CONFIG.DEBUG_MODE) {
            window.addEventListener('unhandledrejection', (event) => {
                if (event.reason && event.reason.message && event.reason.message.includes('fetch')) {
                    utils.log(`Global fetch error: ${event.reason.message}`, 'warning');
                }
            });
        }
    },
    
    addPulseAnimation() {
        if (!document.head) {
            setTimeout(() => this.addPulseAnimation(), 100);
            return;
        }
        
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

// 🏁 Start the application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// 🔧 Expose utility functions for debugging (Berry Browser console access)
if (state.isBerryBrowser && CONFIG.DEBUG_MODE) {
    window.aiStylerDebug = {
        state: state,
        utils: utils,
        cssLoader: cssLoader,
        styleManager: styleManager,
        clearCache: () => utils.clearCache(),
        forceReapply: () => styleManager.apply(),
        showInfo: () => {
            console.log('=== AI Styler Debug Info ===');
            console.log('Site:', state.site.name);
            console.log('Enabled:', state.enabled);
            console.log('CSS Loaded:', !!state.cssContent);
            console.log('CSS Length:', state.cssContent?.length || 0);
            console.log('Style Applied:', styleManager.isApplied());
            console.log('Fetch Attempts:', state.fetchAttempts);
            console.log('Applied Method:', state.appliedMethod);
            console.log('Has Grants:', state.hasGrants);
            console.log('Is Berry:', state.isBerryBrowser);
            console.log('Cache:', utils.getCachedCSS() ? 'Yes' : 'No');
        },
        testFetch: async () => {
            console.log('Testing fetch methods...');
            try {
                const css = await cssLoader.fetchExternalCSS();
                console.log('✅ Fetch successful:', css.length, 'chars');
                return css;
            } catch (error) {
                console.log('❌ Fetch failed:', error.message);
                return null;
            }
        }
    };
    
    utils.log('Debug functions available: window.aiStylerDebug', 'berry');
}

})();
