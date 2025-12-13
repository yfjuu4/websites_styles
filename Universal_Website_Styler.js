// ==UserScript==
// @name         Universal AI Chat Styler (Multi-Site) - Enhanced Berry Debug
// @namespace    http://yourdomain.example
// @version      2.2
// @description  Dynamically load custom CSS for ChatGPT and Claude AI with Berry Browser debugging
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
    DEBUG_MODE: true, // Set to true to see detailed logs
    VERBOSE_BERRY_DEBUG: true, // Extra logging for Berry Browser
    RETRY_DELAY: 500,
    MAX_RETRIES: 20,
    OBSERVER_THROTTLE: 500,
    CACHE_DURATION: 12 * 60 * 60 * 1000,
    CACHE_KEY_PREFIX: 'css_cache_v2_',
    BERRY_INITIAL_DELAY: 3000, // Increased for ChatGPT
    CHATGPT_READY_CHECK_INTERVAL: 200,
    CHATGPT_MAX_READY_CHECKS: 30,
    FETCH_TIMEOUT: 15000
};

// Site configuration
const SITES = {
    'chatgpt.com': {
        name: 'ChatGPT',
        styleURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/refs/heads/main/ChatGpt_style.css',
        styleID: 'chatgpt-enhanced-styles',
        enabledKey: 'chatgpt_styles_enabled',
        needsReadyCheck: true,
        readySelector: 'main, [class*="conversation"], #__next, body',
        aggressiveReapply: true,
        berryExtraDelay: 2000 // Extra delay specifically for ChatGPT in Berry
    },
    'claude.ai': {
        name: 'Claude AI',
        styleURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/refs/heads/main/Claude_AI_style.css',
        styleID: 'claude-enhanced-styles',
        enabledKey: 'claude_styles_enabled',
        needsReadyCheck: false,
        readySelector: 'body',
        aggressiveReapply: false,
        berryExtraDelay: 0
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
    currentURL: location.href,
    isLoading: false,
    hasGrants: false,
    isBerryBrowser: false,
    isReady: false,
    cssContent: null,
    appliedMethod: null,
    lastApplyTime: 0,
    fetchAttempts: [],
    diagnosticLog: []
};

// Enhanced browser detection
(function detectCapabilities() {
    state.hasGrants = typeof GM_xmlhttpRequest !== 'undefined';

    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|mobile/i.test(userAgent);
    const isChromiumBased = /chrome|chromium/i.test(userAgent);

    state.isBerryBrowser = !state.hasGrants && isMobile && isChromiumBased;

    if (state.isBerryBrowser) {
        console.log('🍓 Berry Browser detected - using optimized fallback methods');
    }
})();

// Utility functions
const utils = {
    log(message, level = 'info') {
        if (!CONFIG.DEBUG_MODE && level === 'debug') return;
        if (!CONFIG.VERBOSE_BERRY_DEBUG && level === 'berry-debug') return;
    
        const emoji = {
            'info': 'ℹ️',
            'success': '✅',
            'error': '❌',
            'debug': '🔍',
            'warning': '⚠️',
            'berry-debug': '🍓'
        }[level] || 'ℹ️';
    
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const prefix = `${emoji} [${timestamp}] [${currentSite.name}]`;
        const fullMessage = `${prefix} ${message}`;
        
        console.log(fullMessage);
        
        // Store in diagnostic log
        state.diagnosticLog.push({
            timestamp: Date.now(),
            level,
            message: fullMessage
        });
        
        // Keep only last 50 entries
        if (state.diagnosticLog.length > 50) {
            state.diagnosticLog.shift();
        }
    },

    getDiagnosticReport() {
        return {
            browser: state.isBerryBrowser ? 'Berry Browser' : 'Standard Browser',
            site: currentSite.name,
            hasGrants: state.hasGrants,
            cssContentLength: state.cssContent ? state.cssContent.length : 0,
            appliedMethod: state.appliedMethod,
            fetchAttempts: state.fetchAttempts,
            recentLogs: state.diagnosticLog.slice(-20)
        };
    },

    showDiagnosticReport() {
        const report = this.getDiagnosticReport();
        console.group('🔍 Diagnostic Report');
        console.log('Browser:', report.browser);
        console.log('Site:', report.site);
        console.log('Has GM Grants:', report.hasGrants);
        console.log('CSS Content Length:', report.cssContentLength);
        console.log('Applied Method:', report.appliedMethod);
        console.log('Fetch Attempts:', report.fetchAttempts);
        console.log('Recent Logs:', report.recentLogs);
        console.groupEnd();
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
    
        const { css, timestamp, url } = cacheData;
        const now = Date.now();
    
        if (url !== state.site.styleURL) {
            this.log('CSS URL changed, invalidating cache', 'warning');
            return null;
        }
    
        if (now - timestamp > CONFIG.CACHE_DURATION) {
            this.log('Cache expired', 'debug');
            return null;
        }
    
        this.log(`Using cached CSS (${css.length} chars)`, 'success');
        return css;
    },

    setCachedCSS(css) {
        const cacheKey = CONFIG.CACHE_KEY_PREFIX + state.site.name;
        const cacheData = {
            css: css,
            timestamp: Date.now(),
            url: state.site.styleURL
        };
        return this.setValue(cacheKey, cacheData);
    },

    clearCache() {
        const cacheKey = CONFIG.CACHE_KEY_PREFIX + state.site.name;
        this.setValue(cacheKey, null);
        this.log('Cache cleared', 'info');
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
            this.log('No ready check needed for this site', 'berry-debug');
            return true;
        }

        this.log('Waiting for page to be ready...', 'berry-debug');
    
        const element = await this.waitForElement(state.site.readySelector, 10000);
    
        if (element) {
            this.log(`Page ready - found: ${element.tagName}`, 'success');
        
            if (state.isBerryBrowser) {
                const extraDelay = state.site.berryExtraDelay || 0;
                const totalDelay = CONFIG.BERRY_INITIAL_DELAY + extraDelay;
                
                this.log(`Berry Browser: Applying ${totalDelay}ms delay...`, 'berry-debug');
                await new Promise(resolve => setTimeout(resolve, totalDelay));
                this.log('Berry Browser delay complete', 'berry-debug');
            }
        
            return true;
        }
    
        this.log('Page ready check timed out, continuing anyway', 'warning');
        return false;
    }
};

// Enhanced CSS loader with Berry-specific debugging
const cssLoader = {
    async fetchExternalCSS() {
        const cachedCSS = utils.getCachedCSS();
        if (cachedCSS) {
            state.cssContent = cachedCSS;
            return cachedCSS;
        }

        utils.log(`🔄 Starting fetch from: ${state.site.styleURL}`, 'berry-debug');
        utils.log(`Fetch environment: Berry=${state.isBerryBrowser}, Grants=${state.hasGrants}`, 'berry-debug');
        
        const fetchStart = Date.now();
        
        // Try methods in order based on environment
        const methods = state.isBerryBrowser ? 
            ['fetchDirectWithTimeout', 'fetchViaCORSProxy', 'fetchDirect'] :
            ['fetchViaGM', 'fetchDirect', 'fetchViaCORSProxy'];
        
        for (const methodName of methods) {
            try {
                utils.log(`Attempting: ${methodName}`, 'berry-debug');
                const attemptStart = Date.now();
                
                const css = await this[methodName]();
                
                const attemptDuration = Date.now() - attemptStart;
                
                state.fetchAttempts.push({
                    method: methodName,
                    success: true,
                    duration: attemptDuration,
                    timestamp: Date.now()
                });
                
                state.cssContent = css;
                utils.log(`✅ Success via ${methodName} (${attemptDuration}ms, ${css.length} chars)`, 'success');
                return css;
            } catch (error) {
                const attemptDuration = Date.now() - fetchStart;
                
                state.fetchAttempts.push({
                    method: methodName,
                    success: false,
                    error: error.message,
                    duration: attemptDuration,
                    timestamp: Date.now()
                });
                
                utils.log(`❌ ${methodName} failed: ${error.message}`, 'berry-debug');
            }
        }
    
        const totalDuration = Date.now() - fetchStart;
        utils.log(`All fetch methods failed after ${totalDuration}ms`, 'error');
        utils.showDiagnosticReport();
        throw new Error('All fetch methods failed');
    },

    fetchViaGM() {
        if (!state.hasGrants || typeof GM_xmlhttpRequest === 'undefined') {
            throw new Error('GM_xmlhttpRequest not available');
        }
        
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
                            resolve(css);
                        } else {
                            reject(new Error('Empty response'));
                        }
                    } else {
                        reject(new Error(`HTTP ${response.status}`));
                    }
                },
                onerror: (err) => reject(new Error(`Network error: ${err.error || 'unknown'}`)),
                ontimeout: () => reject(new Error('Request timeout'))
            });
        });
    },

    async fetchDirect() {
        utils.log('🔄 fetchDirect: Starting...', 'berry-debug');
    
        const response = await fetch(state.site.styleURL, {
            method: 'GET',
            headers: {
                'Accept': 'text/css,*/*',
                'Cache-Control': 'no-cache'
            },
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'omit'
        });
    
        utils.log(`fetchDirect: Response status ${response.status}`, 'berry-debug');
    
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
    
        const css = await response.text();
    
        utils.log(`fetchDirect: Got ${css.length} chars`, 'berry-debug');
    
        if (!css || css.trim().length === 0) {
            throw new Error('Empty CSS response');
        }
    
        utils.setCachedCSS(css);
        return css;
    },

    async fetchDirectWithTimeout() {
        utils.log('🔄 fetchDirectWithTimeout: Starting...', 'berry-debug');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            utils.log('fetchDirectWithTimeout: Aborting due to timeout', 'berry-debug');
            controller.abort();
        }, CONFIG.FETCH_TIMEOUT);
    
        try {
            const response = await fetch(state.site.styleURL, {
                method: 'GET',
                headers: {
                    'Accept': 'text/css,*/*',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                signal: controller.signal,
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'omit'
            });
        
            clearTimeout(timeoutId);
        
            utils.log(`fetchDirectWithTimeout: Response status ${response.status}`, 'berry-debug');
        
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
        
            const css = await response.text();
        
            utils.log(`fetchDirectWithTimeout: Got ${css.length} chars`, 'berry-debug');
        
            if (!css || css.trim().length === 0) {
                throw new Error('Empty CSS response');
            }
        
            utils.setCachedCSS(css);
            return css;
        } catch (error) {
            clearTimeout(timeoutId);
            utils.log(`fetchDirectWithTimeout: Error - ${error.message}`, 'berry-debug');
            throw error;
        }
    },

    async fetchViaCORSProxy() {
        const proxies = [
            `https://corsproxy.io/?${encodeURIComponent(state.site.styleURL)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(state.site.styleURL)}`,
            state.site.styleURL
        ];

        for (let i = 0; i < proxies.length; i++) {
            const proxyUrl = proxies[i];
            try {
                utils.log(`🔄 Proxy attempt ${i + 1}/${proxies.length}: ${proxyUrl.substring(0, 60)}...`, 'berry-debug');
            
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
            
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: { 'Accept': 'text/css,*/*' },
                    signal: controller.signal,
                    mode: 'cors',
                    cache: 'no-cache'
                });
            
                clearTimeout(timeoutId);
            
                utils.log(`Proxy ${i + 1}: Response status ${response.status}`, 'berry-debug');
            
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
            
                const css = await response.text();
            
                if (css && css.trim().length > 0) {
                    utils.setCachedCSS(css);
                    utils.log(`Proxy ${i + 1}: Success (${css.length} chars)`, 'berry-debug');
                    return css;
                }
            } catch (error) {
                utils.log(`Proxy ${i + 1} failed: ${error.message}`, 'berry-debug');
                if (i === proxies.length - 1) {
                    throw error;
                }
                continue;
            }
        }
    
        throw new Error('All proxies failed');
    }
};

// Style manager
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
            utils.log('🎨 Starting CSS application process...', 'berry-debug');
            
            await utils.waitForPageReady();
        
            if (!state.cssContent) {
                utils.log('No cached CSS, fetching...', 'berry-debug');
                await cssLoader.fetchExternalCSS();
            } else {
                utils.log(`Using existing CSS content (${state.cssContent.length} chars)`, 'berry-debug');
            }

            if (!state.cssContent || state.cssContent.trim().length === 0) {
                throw new Error('No CSS content available');
            }

            const methods = [
                { name: 'style-element', fn: () => this.injectViaStyle() },
                { name: 'blob-link', fn: () => this.injectViaBlob() },
                { name: 'external-link', fn: () => this.injectViaExternalLink() }
            ];

            for (const method of methods) {
                try {
                    utils.log(`Trying injection via ${method.name}...`, 'berry-debug');
                    if (await method.fn()) {
                        state.appliedMethod = method.name;
                        utils.log(`✅ Styles applied via ${method.name}`, 'success');
                        state.isLoading = false;
                        return true;
                    }
                } catch (error) {
                    utils.log(`${method.name} failed: ${error.message}`, 'berry-debug');
                }
            }
        
            throw new Error('All injection methods failed');
        
        } catch (error) {
            utils.log(`Failed to apply styles: ${error.message}`, 'error');
            state.isLoading = false;
            utils.showDiagnosticReport();
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
    
        return new Promise((resolve) => {
            link.onload = () => {
                state.styleElement = link;
                utils.log('Blob link loaded', 'berry-debug');
                resolve(true);
            };
        
            link.onerror = () => {
                utils.log('Blob link error', 'berry-debug');
                link.remove();
                URL.revokeObjectURL(blobUrl);
                resolve(false);
            };
        
            document.head.appendChild(link);
        
            setTimeout(() => {
                if (link.sheet) {
                    state.styleElement = link;
                    utils.log('Blob link verified via timeout', 'berry-debug');
                    resolve(true);
                } else {
                    utils.log('Blob link failed verification', 'berry-debug');
                    resolve(false);
                }
            }, 1000);
        });
    },

    injectViaStyle() {
        if (!document.head) return false;
    
        const style = document.createElement('style');
        style.id = state.site.styleID;
        style.type = 'text/css';
        style.textContent = state.cssContent;
        style.setAttribute('data-method', 'inline');
    
        try {
            document.head.appendChild(style);
            state.styleElement = style;
            utils.log('Style element injected', 'berry-debug');
            return true;
        } catch (error) {
            utils.log(`Style injection error: ${error.message}`, 'berry-debug');
            style.remove();
            return false;
        }
    },

    async injectViaExternalLink() {
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
                utils.log('External link loaded', 'berry-debug');
                resolve(true);
            };
        
            link.onerror = () => {
                utils.log('External link error', 'berry-debug');
                link.remove();
                resolve(false);
            };
        
            document.head.appendChild(link);
        
            setTimeout(() => {
                utils.log('External link timeout', 'berry-debug');
                resolve(false);
            }, 3000);
        });
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
            if (el.id === state.site.styleID || el.getAttribute('data-site') === currentDomain) {
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
            utils.log('Force reapplying styles', 'berry-debug');
            await this.apply();
        }
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
                utils.log('Style missing, reapplying...', 'berry-debug');
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
        
        // Add diagnostic command
        utils.safeCall(() => {
            GM_registerMenuCommand('📊 Show Diagnostic Report', () => {
                utils.showDiagnosticReport();
                this.showToast('Check console for diagnostic report');
            });
        });
        
        // Add clear cache command
        utils.safeCall(() => {
            GM_registerMenuCommand('🗑️ Clear CSS Cache', () => {
                utils.clearCache();
                state.cssContent = null;
                this.showToast('Cache cleared - reload page');
            });
        });
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
        
        // Long press for diagnostic report
        let longPressTimer;
        button.addEventListener('touchstart', (e) => {
            longPressTimer = setTimeout(() => {
                utils.showDiagnosticReport();
                this.showToast('Diagnostic report in console');
            }, 2000);
        });
        
        button.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
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
        button.innerHTML = isEnabled ? '🎨' : '🚫';
        button.style.opacity = isEnabled ? '1' : '0.6';
        button.title = `${state.site.name}: ${isEnabled ? 'ON' : 'OFF'}`;
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
        utils.log(`🚀 Initializing ${state.site.name} Styler v2.2`, 'info');
        utils.log(`Mode: ${state.isBerryBrowser ? 'Berry Browser' : 'Standard'}`, 'info');
        utils.log(`Debug: ${CONFIG.DEBUG_MODE}, Verbose Berry: ${CONFIG.VERBOSE_BERRY_DEBUG}`, 'info');
    
        const initialDelay = state.isBerryBrowser ? 1500 : 500;
    
        setTimeout(async () => {
            await this.applyWithRetry();
            observerManager.setup();
            menuManager.setup();
            navigationManager.init();
            this.setupEventListeners();
        
            const status = utils.getCurrentSiteEnabled() ? 'ENABLED ✅' : 'DISABLED ❌';
            utils.log(`Initialization complete. Status: ${status}`, 'success');
            
            if (state.isBerryBrowser && CONFIG.VERBOSE_BERRY_DEBUG) {
                setTimeout(() => {
                    utils.log('Post-init diagnostic check:', 'berry-debug');
                    utils.showDiagnosticReport();
                }, 2000);
            }
        }, initialDelay);
    },

    async applyWithRetry() {
        if (!utils.getCurrentSiteEnabled()) return;

        for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
            try {
                utils.log(`Apply attempt ${attempt}/${CONFIG.MAX_RETRIES}`, 'berry-debug');
            
                if (await styleManager.apply()) {
                    utils.log('Styles successfully applied!', 'success');
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
        utils.showDiagnosticReport();
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
    }
};

// Start the application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

})();
