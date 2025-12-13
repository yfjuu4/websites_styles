// ==UserScript==
// @name         Universal AI Chat Styler (Multi-Site) - Berry Browser Fixed
// @namespace    http://yourdomain.example
// @version      4.0
// @description  Dynamically load custom CSS for ChatGPT and Claude AI with Berry Browser CSP workaround
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function() {
'use strict';

// Configuration
const CONFIG = {
    DEBUG_MODE: true,
    RETRY_DELAY: 300,
    MAX_RETRIES: 20,
    OBSERVER_THROTTLE: 500,
    CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
    CACHE_KEY_PREFIX: 'css_cache_v4_',
    BERRY_INITIAL_DELAY: 2000,
    FETCH_TIMEOUT: 15000,
    CSS_UPDATE_CHECK_INTERVAL: 6 * 60 * 60 * 1000 // 6 hours
};

// Site configuration
const SITES = {
    'chatgpt.com': {
        name: 'ChatGPT',
        styleURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/refs/heads/main/ChatGpt%20style.css',
        styleID: 'chatgpt-enhanced-styles',
        enabledKey: 'chatgpt_styles_enabled',
        needsReadyCheck: true,
        readySelector: 'main, [class*="conversation"], #__next',
        aggressiveReapply: true,
        useBlobForCSP: true,
        strictCSP: true // ChatGPT has stricter CSP
    },
    'claude.ai': {
        name: 'Claude AI',
        styleURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/refs/heads/main/Claude%20AI%20style.css',
        styleID: 'claude-enhanced-styles',
        enabledKey: 'claude_styles_enabled',
        needsReadyCheck: false,
        readySelector: 'body',
        aggressiveReapply: false,
        useBlobForCSP: false,
        strictCSP: false
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
    styleElement: null,
    observer: null,
    retryCount: 0,
    menuCommandId: null,
    updateMenuCommandId: null,
    currentURL: location.href,
    isLoading: false,
    hasGrants: false,
    isBerryBrowser: false,
    isReady: false,
    cssContent: null,
    appliedMethod: null,
    lastApplyTime: 0,
    fetchAttempted: false,
    cspBlocked: false,
    lastUpdateCheck: 0
};

// Enhanced browser detection
(function detectCapabilities() {
    state.hasGrants = typeof GM_xmlhttpRequest !== 'undefined';

    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|mobile/i.test(userAgent);
    const isChromiumBased = /chrome|chromium/i.test(userAgent);

    // Berry Browser detection: mobile + chromium + no GM grants
    state.isBerryBrowser = !state.hasGrants && isMobile && isChromiumBased;

    if (state.isBerryBrowser) {
        console.log('🍓 Berry Browser detected - using CSP-safe methods');
    }
})();

// Utility functions
const utils = {
    log(message, level = 'info') {
        if (!CONFIG.DEBUG_MODE && level === 'debug') return;
   
        const emoji = {
            'info': 'ℹ️',
            'success': '✅',
            'error': '❌',
            'debug': '🔍',
            'warning': '⚠️'
        }[level] || 'ℹ️';
   
        const prefix = `${emoji} [${currentSite.name}]`;
        console.log(`${prefix} ${message}`);
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

    safeCall(fn, fallback = null) {
        try {
            return fn();
        } catch (e) {
            this.log(`Error: ${e.message}`, 'error');
            return fallback;
        }
    },

    getValue(key, defaultValue) {
        return this.safeCall(() => {
            if (typeof GM_getValue !== 'undefined') {
                return GM_getValue(key, defaultValue);
            }
            try {
                const item = localStorage.getItem(key);
                return item !== null ? JSON.parse(item) : defaultValue;
            } catch (e) {
                return defaultValue;
            }
        }, defaultValue);
    },

    setValue(key, value) {
        return this.safeCall(() => {
            if (typeof GM_setValue !== 'undefined') {
                GM_setValue(key, value);
                return true;
            }
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                return false;
            }
        }, false);
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
   
        const { css, timestamp, url, version } = cacheData;
        const now = Date.now();
   
        if (url !== state.site.styleURL) {
            this.log('CSS URL changed, invalidating cache', 'warning');
            return null;
        }
   
        // Don't expire cache in Berry Browser for ChatGPT (fallback protection)
        if (state.isBerryBrowser && state.site.strictCSP) {
            this.log('Using cached CSS (Berry Browser + strict CSP mode)', 'info');
            return css;
        }
   
        if (now - timestamp > CONFIG.CACHE_DURATION) {
            this.log('Cache expired', 'debug');
            return null;
        }
   
        this.log(`Using cached CSS (v${version || 1})`, 'success');
        return css;
    },

    setCachedCSS(css) {
        const cacheKey = CONFIG.CACHE_KEY_PREFIX + state.site.name;
        const oldCache = this.getValue(cacheKey, null);
        const version = oldCache ? (oldCache.version || 1) + 1 : 1;
        
        const cacheData = {
            css: css,
            timestamp: Date.now(),
            url: state.site.styleURL,
            version: version,
            berryBrowserCompatible: true
        };
        
        const success = this.setValue(cacheKey, cacheData);
        
        if (success) {
            this.log(`CSS cached successfully (v${version}, ${css.length} chars)`, 'success');
        }
        
        return success;
    },

    getLastUpdateCheck() {
        const key = `last_update_check_${state.site.name}`;
        return this.getValue(key, 0);
    },

    setLastUpdateCheck(timestamp) {
        const key = `last_update_check_${state.site.name}`;
        return this.setValue(key, timestamp);
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
       
            if (state.isBerryBrowser && currentDomain === 'chatgpt.com') {
                this.log('Applying ChatGPT Berry Browser delay...', 'debug');
                await new Promise(resolve => setTimeout(resolve, CONFIG.BERRY_INITIAL_DELAY));
            }
       
            return true;
        }
   
        this.log('Page ready check timed out, continuing anyway', 'warning');
        return false;
    }
};

// Enhanced CSS loader with Berry Browser workarounds
const cssLoader = {
    async fetchExternalCSS(forceUpdate = false) {
        // Always try cache first
        if (!forceUpdate) {
            const cachedCSS = utils.getCachedCSS();
            if (cachedCSS) {
                state.cssContent = cachedCSS;
                state.fetchAttempted = true;
                return cachedCSS;
            }
        }

        // In Berry Browser with strict CSP, show warning if no cache
        if (state.isBerryBrowser && state.site.strictCSP && !forceUpdate) {
            utils.log('⚠️ No cached CSS found for ChatGPT in Berry Browser', 'warning');
            utils.log('💡 Open this page in a desktop browser first to cache the CSS', 'info');
            
            // Still attempt fetch, but expect it to fail
            state.cspBlocked = true;
        }

        utils.log(`Fetching CSS from: ${state.site.styleURL}`, 'info');
        state.fetchAttempted = true;
   
        // Try GM method first (bypasses CSP)
        if (state.hasGrants && typeof GM_xmlhttpRequest !== 'undefined') {
            try {
                const css = await this.fetchViaGM();
                state.cssContent = css;
                state.cspBlocked = false;
                return css;
            } catch (error) {
                utils.log(`GM fetch failed: ${error.message}`, 'error');
            }
        }
   
        // For Berry Browser, try CORS proxies (expect ChatGPT to fail due to CSP)
        utils.log('Attempting CORS proxy fetch...', 'info');
        try {
            const css = await this.fetchViaCORSProxy();
            state.cssContent = css;
            state.cspBlocked = false;
            utils.log('✅ CORS proxy fetch succeeded!', 'success');
            return css;
        } catch (error) {
            utils.log(`CORS proxy fetch failed: ${error.message}`, 'error');
            
            // If we're in Berry Browser with strict CSP, this is expected
            if (state.isBerryBrowser && state.site.strictCSP) {
                state.cspBlocked = true;
                utils.log('🚫 CSP blocked external fetch (expected in Berry Browser + ChatGPT)', 'warning');
                utils.log('💡 Solution: Load this page in desktop browser to cache CSS', 'info');
            }
            
            throw error;
        }
    },

    fetchViaGM() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: state.site.styleURL,
                timeout: CONFIG.FETCH_TIMEOUT,
                headers: {
                    'Accept': 'text/css,*/*',
                    'Cache-Control': 'no-cache'
                },
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300) {
                        const css = response.responseText;
                        if (css && css.trim().length > 0) {
                            utils.setCachedCSS(css);
                            utils.log(`Fetched ${css.length} chars via GM`, 'success');
                            resolve(css);
                        } else {
                            reject(new Error('Empty response'));
                        }
                    } else {
                        reject(new Error(`HTTP ${response.status}`));
                    }
                },
                onerror: () => reject(new Error('Network error')),
                ontimeout: () => reject(new Error('Request timeout'))
            });
        });
    },

    async fetchViaCORSProxy() {
        const proxies = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(state.site.styleURL)}`,
            `https://corsproxy.io/?${encodeURIComponent(state.site.styleURL)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(state.site.styleURL)}`
        ];

        for (let i = 0; i < proxies.length; i++) {
            const proxyUrl = proxies[i];
            try {
                utils.log(`Trying proxy ${i + 1}/${proxies.length}...`, 'debug');
           
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT);
           
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
           
                if (css && css.trim().length > 0 && !css.includes('<!DOCTYPE') && !css.includes('<html')) {
                    utils.setCachedCSS(css);
                    utils.log(`✅ Fetched ${css.length} chars via proxy ${i + 1}`, 'success');
                    return css;
                }
                
                throw new Error('Invalid CSS response (possibly HTML error page)');
            } catch (error) {
                utils.log(`Proxy ${i + 1} failed: ${error.message}`, 'debug');
                if (i === proxies.length - 1) {
                    throw new Error(`All proxies failed. Last error: ${error.message}`);
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
   
        throw new Error('All proxies exhausted');
    },

    async checkForUpdates() {
        const now = Date.now();
        const lastCheck = utils.getLastUpdateCheck();
        
        if (now - lastCheck < CONFIG.CSS_UPDATE_CHECK_INTERVAL) {
            utils.log('Skipping update check (too soon)', 'debug');
            return false;
        }
        
        utils.log('Checking for CSS updates...', 'info');
        utils.setLastUpdateCheck(now);
        
        try {
            const newCSS = await this.fetchExternalCSS(true);
            if (newCSS && newCSS !== state.cssContent) {
                utils.log('New CSS version available!', 'success');
                state.cssContent = newCSS;
                return true;
            }
            utils.log('CSS is up to date', 'debug');
            return false;
        } catch (error) {
            utils.log(`Update check failed: ${error.message}`, 'error');
            return false;
        }
    }
};

// Style manager with CSP-aware injection
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
                utils.log('No CSS content, attempting to fetch...', 'info');
                try {
                    await cssLoader.fetchExternalCSS();
                } catch (error) {
                    // If fetch fails in Berry + ChatGPT, show helpful message
                    if (state.isBerryBrowser && state.site.strictCSP) {
                        utils.log('❌ Cannot fetch CSS due to CSP restrictions', 'error');
                        this.showBerryBrowserNotification();
                        state.isLoading = false;
                        return false;
                    }
                    throw error;
                }
            }

            if (!state.cssContent || state.cssContent.trim().length === 0) {
                throw new Error('No CSS content available');
            }

            // Injection methods prioritized for Berry Browser + CSP
            const methods = state.isBerryBrowser || state.site.useBlobForCSP ? [
                { name: 'inline-style', fn: () => this.injectViaInlineStyle() },
                { name: 'blob-link', fn: () => this.injectViaBlob() },
                { name: 'style-element', fn: () => this.injectViaStyle() }
            ] : [
                { name: 'blob-link', fn: () => this.injectViaBlob() },
                { name: 'style-element', fn: () => this.injectViaStyle() },
                { name: 'inline-style', fn: () => this.injectViaInlineStyle() }
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

    injectViaInlineStyle() {
        if (!document.head) return false;
   
        const style = document.createElement('style');
        style.id = state.site.styleID;
        style.type = 'text/css';
        style.setAttribute('data-method', 'inline-csp-safe');
        style.setAttribute('data-version', 'v4.0');
       
        try {
            style.textContent = state.cssContent;
            document.head.appendChild(style);
            state.styleElement = style;
            utils.log(`Injected ${state.cssContent.length} chars inline`, 'debug');
            return true;
        } catch (error) {
            style.remove();
            utils.log(`Inline style injection failed: ${error.message}`, 'error');
            return false;
        }
    },

    async injectViaBlob() {
        if (!document.head) return false;
   
        const blob = new Blob([state.cssContent], { type: 'text/css' });
        const blobUrl = URL.createObjectURL(blob);
   
        const link = document.createElement('link');
        link.id = state.site.styleID;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = blobUrl;
        link.setAttribute('data-method', 'blob');
        link.setAttribute('data-version', 'v4.0');
   
        return new Promise((resolve) => {
            link.onload = () => {
                state.styleElement = link;
                utils.log('Blob URL loaded successfully', 'debug');
                resolve(true);
            };
       
            link.onerror = (e) => {
                utils.log(`Blob load error: ${e}`, 'debug');
                link.remove();
                URL.revokeObjectURL(blobUrl);
                resolve(false);
            };
       
            document.head.appendChild(link);
       
            setTimeout(() => {
                if (link.sheet && link.sheet.cssRules) {
                    state.styleElement = link;
                    resolve(true);
                } else {
                    utils.log('Blob timeout', 'debug');
                    resolve(false);
                }
            }, 2000);
        });
    },

    injectViaStyle() {
        if (!document.head) return false;
   
        const style = document.createElement('style');
        style.id = state.site.styleID;
        style.type = 'text/css';
        style.textContent = state.cssContent;
        style.setAttribute('data-method', 'style-tag');
        style.setAttribute('data-version', 'v4.0');
   
        try {
            document.head.appendChild(style);
            state.styleElement = style;
            return true;
        } catch (error) {
            style.remove();
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
   
        const orphans = document.querySelectorAll(`[data-method]`);
        orphans.forEach(el => {
            if (el.id === state.site.styleID) {
                if (el.tagName === 'LINK' && el.href.startsWith('blob:')) {
                    URL.revokeObjectURL(el.href);
                }
                el.remove();
            }
        });
   
        state.styleElement = null;
        utils.log('Styles removed', 'debug');
    },

    isApplied() {
        return !!document.getElementById(state.site.styleID);
    },

    async forceReapply() {
        if (utils.getCurrentSiteEnabled() && !this.isApplied()) {
            utils.log('Force reapplying styles', 'debug');
            await this.apply();
        }
    },

    showBerryBrowserNotification() {
        if (!state.isBerryBrowser || !state.site.strictCSP) return;
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            left: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 20px;
            border-radius: 12px;
            font-size: 14px;
            line-height: 1.5;
            z-index: 999999;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            animation: slideDown 0.3s ease;
        `;
        
        notification.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 16px;">
                🍓 Berry Browser + ChatGPT Notice
            </div>
            <div style="margin-bottom: 12px;">
                Due to ChatGPT's strict security policy, CSS cannot be fetched directly in Berry Browser.
            </div>
            <div style="font-size: 13px; opacity: 0.95;">
                <strong>Solution:</strong> Open ChatGPT once in a desktop browser (Chrome/Firefox) with this script installed. 
                The CSS will be cached and then work in Berry Browser!
            </div>
            <button id="dismiss-berry-notice" style="
                margin-top: 12px;
                padding: 8px 16px;
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.3);
                border-radius: 6px;
                color: white;
                cursor: pointer;
                font-size: 13px;
            ">Got it</button>
        `;
        
        const addNotification = () => {
            if (document.body) {
                document.body.appendChild(notification);
                
                const dismissBtn = document.getElementById('dismiss-berry-notice');
                if (dismissBtn) {
                    dismissBtn.onclick = () => {
                        notification.style.animation = 'slideUp 0.3s ease';
                        setTimeout(() => notification.remove(), 300);
                    };
                }
                
                // Auto-dismiss after 15 seconds
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.style.animation = 'slideUp 0.3s ease';
                        setTimeout(() => notification.remove(), 300);
                    }
                }, 15000);
            } else {
                setTimeout(addNotification, 100);
            }
        };
        
        // Add CSS animations
        if (!document.getElementById('berry-notification-styles')) {
            const styleTag = document.createElement('style');
            styleTag.id = 'berry-notification-styles';
            styleTag.textContent = `
                @keyframes slideDown {
                    from { transform: translateY(-100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(0); opacity: 1; }
                    to { transform: translateY(-100%); opacity: 0; }
                }
            `;
            document.head.appendChild(styleTag);
        }
        
        addNotification();
    }
};

// Observer manager
const observerManager = {
    setup() {
        this.cleanup();
        if (!utils.getCurrentSiteEnabled()) return;

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
        const maxChecks = 100;
   
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
        utils.log('Observer cleaned up', 'debug');
    }
};

// Menu manager
const menuManager = {
    setup() {
        if (typeof GM_registerMenuCommand !== 'undefined') {
            this.createMenuCommands();
        } else {
            this.createFloatingButton();
        }
    },

    createMenuCommands() {
        this.updateToggleCommand();
        this.updateManualUpdateCommand();
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
            this.toggleCurrentSiteStyles();
        });
        
        // Long press for manual update
        let pressTimer;
        button.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(() => {
                this.manualUpdate();
            }, 1000);
        });
        button.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
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
        if (!button) button = document.getElementById('ai-styler-btn');
        if (!button) return;
   
        const isEnabled = utils.getCurrentSiteEnabled();
        const hasCSS = !!state.cssContent;
        
        let emoji = '🎨';
        let opacity = '1';
        let title = `${state.site.name}: ${isEnabled ? 'ON' : 'OFF'}`;
        
        if (!hasCSS && state.isBerryBrowser && state.site.strictCSP) {
            emoji = '⚠️';
            title += ' (No cached CSS - load in desktop browser first)';
        } else if (!isEnabled) {
            emoji = '🚫';
            opacity = '0.6';
        }
        
        button.innerHTML = emoji;
        button.style.opacity = opacity;
        button.title = title;
    },

    updateToggleCommand() {
        utils.safeCall(() => {
            if (state.menuCommandId && typeof GM_unregisterMenuCommand !== 'undefined') {
                GM_unregisterMenuCommand(state.menuCommandId);
            }

            const isEnabled = utils.getCurrentSiteEnabled();
            const text = `${isEnabled ? '✅' : '❌'} ${state.site.name} Styles`;
       
            state.menuCommandId = GM_registerMenuCommand(text, () => {
                this.toggleCurrentSiteStyles();
            });
        });
    },

    updateManualUpdateCommand() {
        utils.safeCall(() => {
            if (state.updateMenuCommandId && typeof GM_unregisterMenuCommand !== 'undefined') {
                GM_unregisterMenuCommand(state.updateMenuCommandId);
            }

            const text = `🔄 Update ${state.site.name} CSS`;
       
            state.updateMenuCommandId = GM_registerMenuCommand(text, () => {
                this.manualUpdate();
            });
        });
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
        this.updateToggleCommand();
        this.showToast(`${state.site.name}: ${newEnabled ? 'ON' : 'OFF'}`);
    },

    async manualUpdate() {
        this.showToast('Checking for CSS updates...', 3000);
        
        try {
            const updated = await cssLoader.checkForUpdates();
            
            if (updated) {
                await styleManager.apply();
                this.showToast('✅ CSS updated successfully!');
                this.updateButtonState();
            } else {
                this.showToast('CSS is already up to date');
            }
        } catch (error) {
            utils.log(`Manual update failed: ${error.message}`, 'error');
            this.showToast('❌ Update failed - check console');
        }
    },

    showToast(message, duration = 2000) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            left: 20px;
            max-width: 400px;
            margin: 0 auto;
            background: rgba(0,0,0,0.85);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 999998;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: all 0.3s;
        `;
   
        toast.textContent = message;
   
        const addToast = () => {
            if (document.body) {
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateY(10px)';
                    setTimeout(() => toast.remove(), 300);
                }, duration);
            } else {
                setTimeout(addToast, 100);
            }
        };
        addToast();
    }
};

// Navigation manager
const navigationManager = {
    init() {
        if (!state.isBerryBrowser) {
            this.overrideHistoryMethods();
        }
   
        window.addEventListener('popstate', this.handleURLChange);
        window.addEventListener('hashchange', this.handleURLChange);
    },

    overrideHistoryMethods() {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function(...args) {
            originalPushState.apply(this, args);
            navigationManager.handleURLChange();
        };

        history.replaceState = function(...args) {
            originalReplaceState.apply(this, args);
            navigationManager.handleURLChange();
        };
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

// Main app
const app = {
    async init() {
        utils.log(`🚀 Initializing ${state.site.name} Styler v4.0`, 'info');
        utils.log(`Mode: ${state.isBerryBrowser ? '🍓 Berry Browser' : '💻 Standard Browser'}`, 'info');
        utils.log(`Strict CSP: ${state.site.strictCSP ? 'YES (ChatGPT)' : 'NO'}`, 'info');
   
        const initialDelay = state.isBerryBrowser ? 1500 : 500;
   
        setTimeout(async () => {
            await this.applyWithRetry();
            observerManager.setup();
            menuManager.setup();
            navigationManager.init();
            this.setupEventListeners();
       
            const status = utils.getCurrentSiteEnabled() ? 'ENABLED ✅' : 'DISABLED ❌';
            utils.log(`Initialization complete. Status: ${status}`, 'success');
           
            if (state.appliedMethod) {
                utils.log(`Applied using: ${state.appliedMethod}`, 'info');
            }
            
            if (state.cssContent) {
                utils.log(`CSS size: ${state.cssContent.length} chars`, 'debug');
            }
            
            // Periodic update check (only in standard browsers with GM grants)
            if (!state.isBerryBrowser && state.hasGrants) {
                this.startPeriodicUpdateCheck();
            }
        }, initialDelay);
    },

    async applyWithRetry() {
        if (!utils.getCurrentSiteEnabled()) return;

        for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
            try {
                utils.log(`Apply attempt ${attempt}/${CONFIG.MAX_RETRIES}`, 'debug');
           
                if (await styleManager.apply()) {
                    utils.log('✨ Styles successfully applied!', 'success');
                    return;
                }
            } catch (error) {
                utils.log(`Attempt ${attempt} error: ${error.message}`, 'error');
            }

            if (attempt < CONFIG.MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
            }
        }
   
        utils.log('⚠️ Max retries reached', 'warning');
        
        // Show Berry Browser notification if applicable
        if (state.isBerryBrowser && state.site.strictCSP && !state.cssContent) {
            styleManager.showBerryBrowserNotification();
        }
    },

    setupEventListeners() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && utils.getCurrentSiteEnabled()) {
                setTimeout(() => styleManager.forceReapply(), 200);
            }
        });

        window.addEventListener('focus', () => {
            if (utils.getCurrentSiteEnabled()) {
                setTimeout(() => styleManager.forceReapply(), 200);
            }
        });

        window.addEventListener('beforeunload', () => {
            observerManager.cleanup();
        });
    },

    startPeriodicUpdateCheck() {
        setInterval(async () => {
            if (utils.getCurrentSiteEnabled() && document.visibilityState === 'visible') {
                const updated = await cssLoader.checkForUpdates();
                if (updated) {
                    utils.log('Auto-update: New CSS version detected', 'info');
                    await styleManager.apply();
                }
            }
        }, CONFIG.CSS_UPDATE_CHECK_INTERVAL);
    }
};

// Start the application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

})();
