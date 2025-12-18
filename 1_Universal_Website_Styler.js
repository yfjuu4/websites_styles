// ==UserScript==
// @name         Universal Site Styler with Per-Site Control
// @namespace    http://yourdomain.example
// @version      5
// @description  Load custom CSS from GitHub with per-site enable/disable control and hideable button
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://context.reverso.net/*
// @match        https://chat.deepseek.com/*
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function() {
'use strict';

// 🎯 Configuration
const CONFIG = {
    DEBUG_MODE: false,
    RETRY_DELAY: 500,
    MAX_RETRIES: 15,
    OBSERVER_THROTTLE: 1000,
    CACHE_DURATION: 6 * 60 * 60 * 1000,
    CACHE_KEY_PREFIX: 'css_cache_',
    BERRY_INITIAL_DELAY: 4000,
    CHATGPT_READY_CHECK_INTERVAL: 200,
    CHATGPT_MAX_READY_CHECKS: 30,
   
    // Per-site configuration storage
    SITE_SETTINGS_KEY: 'site_styler_settings_v2',
   
    // 🆕 Button visibility control
    BUTTON_VISIBLE_BY_DEFAULT: false,
    BUTTON_VISIBILITY_KEY: 'site_styler_button_visible'
};

// 🎨 Site configuration - GitHub raw URLs only
const SITES = {
    'chatgpt.com': {
        name: 'ChatGPT',
        styleURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/ChatGpt_style.css',
        styleID: 'chatgpt-enhanced-styles',
        needsReadyCheck: false,
        readySelector: 'main, [class*="conversation"], #__next',
        aggressiveReapply: false,
        enabledByDefault: true
    },
    'claude.ai': {
        name: 'Claude AI',
        styleURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/Claude_AI_style.css',
        styleID: 'claude-enhanced-styles',
        needsReadyCheck: false,
        readySelector: 'body',
        aggressiveReapply: false,
        enabledByDefault: true
    },
    'context.reverso.net': {
        name: 'Reverso Context',
        styleURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/reverso%20context%20style.css',
        styleID: 'reverso-context-enhanced-styles',
        needsReadyCheck: false,
        readySelector: 'body',
        aggressiveReapply: false,
        enabledByDefault: true
    },
    'chat.deepseek.com': {
        name: 'DeepSeek',
        styleURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/refs/heads/main/deepseek%20style.css',
        styleID: 'deepseek-enhanced-styles',
        needsReadyCheck: false,
        readySelector: 'body',
        aggressiveReapply: false,
        enabledByDefault: true
    }
};

// 🏗️ Detect current site
const currentDomain = window.location.hostname;
const currentSite = SITES[currentDomain] || null;

if (!currentSite) {
    console.log('Site Styler: No configuration found for this domain');
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
    hasGrants: false,
    isBerryBrowser: false,
    cssContent: null,
    appliedMethod: null,
    lastApplyTime: 0,
    fetchAttempts: 0,
    enabled: true
};

// 🔍 Browser detection
(function detectCapabilities() {
    state.hasGrants = typeof GM_xmlhttpRequest !== 'undefined';
  
    // Simple Berry Browser detection
    const userAgent = navigator.userAgent.toLowerCase();
    state.isBerryBrowser = !state.hasGrants && /android/.test(userAgent);
  
    if (state.isBerryBrowser) {
        console.log('🍓 Berry Browser detected - using GitHub direct fetch');
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
            'berry': '🍓',
            'github': '🐙',
            'config': '⚙️'
        }[level] || 'ℹ️';
      
        const prefix = state.isBerryBrowser ? `${emoji}🍓` : emoji;
        console.log(`${prefix} [${currentSite.name}] ${message}`);
    },
  
    // 🆕 PER-SITE SETTINGS MANAGEMENT
    getSiteSettings() {
        try {
            const settings = localStorage.getItem(CONFIG.SITE_SETTINGS_KEY);
            return settings ? JSON.parse(settings) : {};
        } catch (e) {
            this.log('Failed to load site settings, using defaults', 'warning');
            return {};
        }
    },
  
    saveSiteSettings(settings) {
        try {
            localStorage.setItem(CONFIG.SITE_SETTINGS_KEY, JSON.stringify(settings));
            return true;
        } catch (e) {
            this.log('Failed to save site settings', 'error');
            return false;
        }
    },
  
    // Get enabled state for current site
    getSiteEnabledState() {
        const settings = this.getSiteSettings();
        const siteKey = currentDomain;
       
        // If we have a saved setting for this site, use it
        if (settings[siteKey] !== undefined) {
            this.log(`Using saved setting: ${settings[siteKey] ? 'ENABLED' : 'DISABLED'}`, 'config');
            return settings[siteKey];
        }
       
        // Otherwise use the default from SITES config
        const defaultState = currentSite.enabledByDefault !== false;
        this.log(`Using default setting: ${defaultState ? 'ENABLED' : 'DISABLED'}`, 'config');
        return defaultState;
    },
  
    // Save enabled state for current site
    saveSiteEnabledState(isEnabled) {
        const settings = this.getSiteSettings();
        settings[currentDomain] = isEnabled;
        this.saveSiteSettings(settings);
        this.log(`Saved site setting: ${isEnabled ? 'ENABLED' : 'DISABLED'}`, 'config');
    },
  
    // Get all site settings (for debug panel)
    getAllSiteSettings() {
        const settings = this.getSiteSettings();
        const result = {};
       
        Object.keys(SITES).forEach(domain => {
            if (settings[domain] !== undefined) {
                result[domain] = settings[domain];
            } else {
                result[domain] = SITES[domain].enabledByDefault !== false;
            }
        });
       
        return result;
    },
  
    // Reset all site settings to defaults
    resetAllSiteSettings() {
        const defaultSettings = {};
        Object.keys(SITES).forEach(domain => {
            defaultSettings[domain] = SITES[domain].enabledByDefault !== false;
        });
        this.saveSiteSettings(defaultSettings);
        this.log('All site settings reset to defaults', 'success');
        return defaultSettings;
    },
  
    // 🆕 BUTTON VISIBILITY FUNCTIONS
    getButtonVisibility() {
        try {
            const stored = localStorage.getItem(CONFIG.BUTTON_VISIBILITY_KEY);
            return stored !== null ? JSON.parse(stored) : CONFIG.BUTTON_VISIBLE_BY_DEFAULT;
        } catch (e) {
            return CONFIG.BUTTON_VISIBLE_BY_DEFAULT;
        }
    },
   
    saveButtonVisibility(isVisible) {
        try {
            localStorage.setItem(CONFIG.BUTTON_VISIBILITY_KEY, JSON.stringify(isVisible));
            return true;
        } catch (e) {
            return false;
        }
    },
   
    toggleButtonVisibility() {
        const current = this.getButtonVisibility();
        const newState = !current;
        this.saveButtonVisibility(newState);
        return newState;
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
  
    // localStorage-based storage
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
  
        if (url !== state.site.styleURL) {
            this.log('CSS URL changed, invalidating cache', 'debug');
            return null;
        }
  
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
            url: state.site.styleURL
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

// 🆕 Initialize state.enabled from saved settings
state.enabled = utils.getSiteEnabledState();

// 📥 CSS loader optimized for Berry Browser (GitHub only)
const cssLoader = {
    async fetchExternalCSS() {
        state.fetchAttempts++;
      
        const cachedCSS = utils.getCachedCSS();
        if (cachedCSS) {
            state.cssContent = cachedCSS;
            return cachedCSS;
        }

        utils.log(`Fetch attempt #${state.fetchAttempts}`, 'info');
        utils.log(`GitHub URL: ${state.site.styleURL}`, 'debug');
      
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
      
        if (state.isBerryBrowser) {
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
      
        try {
            const css = await this.fetchDirect();
            utils.setCachedCSS(css);
            state.cssContent = css;
            return css;
        } catch (directError) {
            utils.log(`Direct fetch failed: ${directError.message}`, 'debug');
          
            try {
                const css = await this.fetchViaCORSProxy();
                utils.setCachedCSS(css);
                state.cssContent = css;
                return css;
            } catch (proxyError) {
                utils.log(`All fetch methods failed`, 'error');
                throw new Error(`Could not fetch CSS from GitHub`);
            }
        }
    },
  
    fetchViaGM() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: state.site.styleURL,
                timeout: 15000,
                headers: {
                    'Accept': 'text/css,*/*',
                    'Cache-Control': 'no-cache'
                },
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300) {
                        const css = response.responseText;
                        if (css && css.trim().length > 0) {
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
  
    async fetchDirect() {
        utils.log('Trying direct GitHub fetch...', 'github');
      
        const response = await fetch(state.site.styleURL, {
            method: 'GET',
            headers: { 'Accept': 'text/css,*/*' },
            mode: 'cors',
            cache: 'no-store'
        });
      
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
      
        const css = await response.text();
      
        if (!css || css.trim().length === 0) {
            throw new Error('Empty CSS response');
        }
      
        utils.log(`Fetched ${css.length} chars from GitHub`, 'success');
        return css;
    },
  
    async fetchForBerryBrowser() {
        utils.log('Berry: Starting GitHub fetch...', 'berry');
      
        const strategies = [
            { url: state.site.styleURL, mode: 'no-cors', desc: 'GitHub no-cors' },
            { url: state.site.styleURL, mode: 'cors', desc: 'GitHub cors' }
        ];
      
        for (const strategy of strategies) {
            utils.log(`Berry: Trying ${strategy.desc}...`, 'debug');
          
            try {
                const response = await fetch(strategy.url, {
                    method: 'GET',
                    mode: strategy.mode,
                    cache: 'no-store'
                });
              
                const css = await response.text();
              
                if (css && css.trim().length > 10) {
                    utils.log(`Berry (${strategy.desc}): Got ${css.length} chars`, 'success');
                    return css;
                }
            } catch (error) {
                utils.log(`Berry (${strategy.desc}) failed: ${error.message}`, 'debug');
                continue;
            }
        }
      
        throw new Error('All GitHub fetch strategies failed');
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
                utils.log(`Trying proxy ${i + 1}/${proxies.length} for GitHub`, 'debug');
              
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: { 'Accept': 'text/css,*/*' },
                    cache: 'no-store'
                });
              
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
                if (i === proxies.length - 1) {
                    throw error;
                }
                continue;
            }
        }
      
        throw new Error('All proxies failed');
    }
};

// 🎨 Style manager
const styleManager = {
    async apply() {
        if (!state.enabled || state.isLoading) {
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
                utils.log('Fetching CSS from GitHub...', 'info');
                await cssLoader.fetchExternalCSS();
            }

            if (!state.cssContent || state.cssContent.trim().length === 0) {
                throw new Error('No CSS content available');
            }

            if (this.injectViaStyle()) {
                state.appliedMethod = 'style-element';
                utils.log('✅ Styles applied via style element', 'success');
                state.isLoading = false;
                return true;
            }
          
            if (await this.injectViaBlob()) {
                state.appliedMethod = 'blob-link';
                utils.log('✅ Styles applied via blob link', 'success');
                state.isLoading = false;
                return true;
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
  
    injectViaStyle() {
        if (!document.head) return false;
  
        const style = document.createElement('style');
        style.id = state.site.styleID;
        style.type = 'text/css';
        style.textContent = state.cssContent;
  
        try {
            document.head.appendChild(style);
            state.styleElement = style;
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
        const maxChecks = 50;
  
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

// 📱 Enhanced UI Manager with Hideable Button
const uiManager = {
    setup() {
        this.createFloatingButton();
        this.createSettingsPanel();
    },
  
    createFloatingButton() {
        const button = document.createElement('div');
        button.id = 'site-styler-btn';
       
        // 🆕 Check if button should be visible
        const isButtonVisible = utils.getButtonVisibility();
       
        // 🆕 Add visibility class for CSS targeting
        if (!isButtonVisible) {
            button.classList.add('hidden-button');
        }
       
        button.style.cssText = `
            position: fixed;
            bottom: 80px;
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
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        `;
       
        // 🆕 Apply hidden state if needed
        if (!isButtonVisible) {
            button.style.transform = 'translateX(100px) scale(0.8)';
            button.style.opacity = '0';
            button.style.pointerEvents = 'none';
        }
       
        this.updateButtonState(button);
       
        // 🆕 Add button animation styles
        this.addButtonAnimations();
  
        // Click: Toggle current site styles
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.toggleCurrentSite();
        });
  
        // Long press: Show settings panel
        let longPressTimer;
        button.addEventListener('touchstart', (e) => {
            longPressTimer = setTimeout(() => {
                this.toggleSettingsPanel();
            }, 1000);
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
  
    addButtonAnimations() {
        if (!document.head || document.getElementById('button-animations')) return;
      
        const style = document.createElement('style');
        style.id = 'button-animations';
        style.textContent = `
            #site-styler-btn.hidden-button {
                transform: translateX(100px) scale(0.8) !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
           
            #site-styler-btn:not(.hidden-button) {
                transform: translateX(0) scale(1) !important;
                opacity: 1 !important;
                pointer-events: auto !important;
            }
        `;
        document.head.appendChild(style);
    },
  
    updateButtonState(button) {
        if (!button) button = document.getElementById('site-styler-btn');
        if (!button) return;
  
        button.innerHTML = state.enabled ? '🎨' : '🚫';
        button.style.opacity = state.enabled ? '1' : '0.6';
        button.title = `${state.site.name}: ${state.enabled ? 'ON' : 'OFF'}\nLong press for settings`;
      
        // Add pulse animation when loading
        if (state.isLoading) {
            button.style.animation = 'pulse 1.5s infinite';
        } else {
            button.style.animation = 'none';
        }
    },
  
    toggleCurrentSite() {
        state.enabled = !state.enabled;
        utils.saveSiteEnabledState(state.enabled);
      
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
  
    // 🆕 Toggle button visibility
    toggleButtonVisibility() {
        const button = document.getElementById('site-styler-btn');
        const currentVisibility = utils.getButtonVisibility();
        const newVisibility = !currentVisibility;
       
        // Save the new visibility setting
        utils.saveButtonVisibility(newVisibility);
       
        // Update button class for CSS targeting
        if (button) {
            if (newVisibility) {
                button.classList.remove('hidden-button');
                button.style.pointerEvents = 'auto';
            } else {
                button.classList.add('hidden-button');
                button.style.pointerEvents = 'none';
            }
        }
       
        this.showToast(`Button ${newVisibility ? 'shown' : 'hidden'}`);
        return newVisibility;
    },
  
    createSettingsPanel() {
        // Create panel container
        const panel = document.createElement('div');
        panel.id = 'site-styler-settings';
        panel.style.cssText = `
            position: fixed;
            bottom: 140px;
            right: 20px;
            background: rgba(0,0,0,0.95);
            color: white;
            padding: 20px;
            border-radius: 12px;
            z-index: 999998;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
            display: none;
            flex-direction: column;
            gap: 15px;
            min-width: 300px;
            max-width: 90vw;
            max-height: 70vh;
            overflow-y: auto;
            font-family: system-ui, -apple-system, sans-serif;
            animation: slideIn 0.3s ease;
        `;
      
        // Title
        const title = document.createElement('div');
        title.textContent = '🎨 Site Styler Settings';
        title.style.cssText = `
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.2);
            padding-bottom: 10px;
        `;
        panel.appendChild(title);
      
        // Current site info
        const currentSiteInfo = document.createElement('div');
        currentSiteInfo.innerHTML = `
            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 5px;">CURRENT SITE</div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>${state.site.name}</span>
                <button id="toggle-current-site" style="
                    background: ${state.enabled ? '#4CAF50' : '#f44336'};
                    color: white;
                    border: none;
                    padding: 5px 15px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 12px;
                ">${state.enabled ? 'ENABLED' : 'DISABLED'}</button>
            </div>
        `;
        panel.appendChild(currentSiteInfo);
      
        // 🆕 BUTTON VISIBILITY SECTION
        const buttonSection = document.createElement('div');
        buttonSection.style.cssText = `
            padding: 10px;
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            margin: 10px 0;
        `;
       
        const buttonTitle = document.createElement('div');
        buttonTitle.textContent = 'Button Settings';
        buttonTitle.style.cssText = `
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #90CAF9;
        `;
        buttonSection.appendChild(buttonTitle);
       
        // Current button state
        const buttonState = document.createElement('div');
        buttonState.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            font-size: 13px;
        `;
        const isButtonVisible = utils.getButtonVisibility();
        buttonState.innerHTML = `
            <span>Floating button:</span>
            <span style="color: ${isButtonVisible ? '#4CAF50' : '#f44336'}">
                ${isButtonVisible ? 'VISIBLE' : 'HIDDEN'}
            </span>
        `;
        buttonSection.appendChild(buttonState);
       
        // Toggle button visibility button
        const toggleButtonBtn = document.createElement('button');
        toggleButtonBtn.id = 'toggle-button-visibility';
        toggleButtonBtn.textContent = isButtonVisible ? 'Hide Button' : 'Show Button';
        toggleButtonBtn.style.cssText = `
            width: 100%;
            background: ${isButtonVisible ? '#f44336' : '#4CAF50'};
            color: white;
            border: none;
            padding: 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            transition: background 0.3s;
        `;
       
        toggleButtonBtn.addEventListener('click', () => {
            const newVisibility = this.toggleButtonVisibility();
           
            // Update button text and color
            toggleButtonBtn.textContent = newVisibility ? 'Hide Button' : 'Show Button';
            toggleButtonBtn.style.background = newVisibility ? '#f44336' : '#4CAF50';
           
            // Update status text
            buttonState.innerHTML = `
                <span>Floating button:</span>
                <span style="color: ${newVisibility ? '#4CAF50' : '#f44336'}">
                    ${newVisibility ? 'VISIBLE' : 'HIDDEN'}
                </span>
            `;
        });
       
        buttonSection.appendChild(toggleButtonBtn);
        panel.appendChild(buttonSection);
      
        // All sites settings
        const allSitesTitle = document.createElement('div');
        allSitesTitle.textContent = 'ALL SITES';
        allSitesTitle.style.cssText = `
            font-size: 12px;
            opacity: 0.8;
            margin-top: 5px;
            margin-bottom: 10px;
        `;
        panel.appendChild(allSitesTitle);
      
        const sitesList = document.createElement('div');
        sitesList.id = 'sites-list';
        sitesList.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;
        panel.appendChild(sitesList);
      
        // Actions
        const actions = document.createElement('div');
        actions.style.cssText = `
            display: flex;
            gap: 10px;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid rgba(255,255,255,0.2);
        `;
      
        const resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reset All';
        resetBtn.style.cssText = `
            background: #ff9800;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 6px;
            cursor: pointer;
            flex: 1;
        `;
        resetBtn.addEventListener('click', () => {
            if (confirm('Reset all site settings to defaults?')) {
                utils.resetAllSiteSettings();
                this.refreshSettingsPanel();
                state.enabled = utils.getSiteEnabledState();
                this.updateButtonState();
                this.showToast('All settings reset');
            }
        });
      
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            background: #666;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 6px;
            cursor: pointer;
            flex: 1;
        `;
        closeBtn.addEventListener('click', () => {
            this.toggleSettingsPanel();
        });
      
        actions.appendChild(resetBtn);
        actions.appendChild(closeBtn);
        panel.appendChild(actions);
      
        // Add panel to body
        document.body.appendChild(panel);
      
        // Add event listeners
        document.getElementById('toggle-current-site').addEventListener('click', () => {
            this.toggleCurrentSite();
            this.refreshSettingsPanel();
        });
      
        // Initial refresh of sites list
        this.refreshSettingsPanel();
    },
  
    refreshSettingsPanel() {
        const sitesList = document.getElementById('sites-list');
        if (!sitesList) return;
      
        const allSettings = utils.getAllSiteSettings();
        sitesList.innerHTML = '';
      
        Object.keys(SITES).forEach(domain => {
            const site = SITES[domain];
            const isEnabled = allSettings[domain];
            const isCurrent = domain === currentDomain;
          
            const siteItem = document.createElement('div');
            siteItem.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px;
                background: ${isCurrent ? 'rgba(100, 100, 255, 0.2)' : 'transparent'};
                border-radius: 6px;
                border: 1px solid rgba(255,255,255,0.1);
            `;
          
            const siteName = document.createElement('div');
            siteName.textContent = site.name;
            siteName.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
            `;
          
            if (isCurrent) {
                const currentBadge = document.createElement('span');
                currentBadge.textContent = '●';
                currentBadge.style.cssText = `
                    color: #4CAF50;
                    font-size: 12px;
                `;
                siteName.prepend(currentBadge);
            }
          
            const toggleBtn = document.createElement('button');
            toggleBtn.textContent = isEnabled ? 'ON' : 'OFF';
            toggleBtn.style.cssText = `
                background: ${isEnabled ? '#4CAF50' : '#f44336'};
                color: white;
                border: none;
                padding: 4px 12px;
                border-radius: 12px;
                cursor: pointer;
                font-size: 11px;
                min-width: 50px;
            `;
          
            toggleBtn.addEventListener('click', () => {
                const settings = utils.getSiteSettings();
                settings[domain] = !isEnabled;
                utils.saveSiteSettings(settings);
              
                // If toggling current site, update UI immediately
                if (domain === currentDomain) {
                    state.enabled = !isEnabled;
                    if (state.enabled) {
                        styleManager.apply();
                        observerManager.setup();
                    } else {
                        styleManager.remove();
                        observerManager.cleanup();
                    }
                    this.updateButtonState();
                }
              
                this.refreshSettingsPanel();
                this.showToast(`${site.name}: ${!isEnabled ? 'ENABLED' : 'DISABLED'}`);
            });
          
            siteItem.appendChild(siteName);
            siteItem.appendChild(toggleBtn);
            sitesList.appendChild(siteItem);
        });
      
        // Update current site toggle button
        const currentToggleBtn = document.getElementById('toggle-current-site');
        if (currentToggleBtn) {
            currentToggleBtn.textContent = state.enabled ? 'ENABLED' : 'DISABLED';
            currentToggleBtn.style.background = state.enabled ? '#4CAF50' : '#f44336';
        }
    },
  
    toggleSettingsPanel() {
        const panel = document.getElementById('site-styler-settings');
        if (!panel) return;
      
        if (panel.style.display === 'flex') {
            panel.style.display = 'none';
        } else {
            panel.style.display = 'flex';
            this.refreshSettingsPanel();
        }
    },
  
    showDebugInfo() {
        const allSettings = utils.getAllSiteSettings();
        const info = `
🍓 Site Styler Debug Info:
Current Site: ${state.site.name} (${state.enabled ? 'ENABLED' : 'DISABLED'})
GitHub URL: ${state.site.styleURL}
Button Visible: ${utils.getButtonVisibility() ? 'YES' : 'NO'}

ALL SITE SETTINGS:
${Object.keys(allSettings).map(domain => `  ${domain}: ${allSettings[domain] ? '✅' : '❌'}`).join('\n')}

CSS Content: ${state.cssContent ? state.cssContent.length + ' chars' : 'None'}
Applied Method: ${state.appliedMethod || 'None'}
Style Applied: ${styleManager.isApplied()}
        `.trim();
      
        console.log(info);
        this.showToast('Debug info logged to console');
    },
  
    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 140px;
            right: 20px;
            background: rgba(0,0,0,0.85);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 999997;
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
        utils.log(`🚀 Initializing ${state.site.name} Styler v5.3`, 'info');
        utils.log(`Mode: ${state.isBerryBrowser ? '🍓 Berry Browser' : 'Standard'}`, 'info');
        utils.log(`Source: GitHub Raw URLs`, 'github');
        utils.log(`Site setting: ${state.enabled ? 'ENABLED' : 'DISABLED'}`, 'config');
        utils.log(`Button: ${utils.getButtonVisibility() ? 'VISIBLE' : 'HIDDEN'}`, 'config');
  
        // Add CSS animations
        this.addPulseAnimation();
  
        // Initial delay
        const initialDelay = state.isBerryBrowser ? 2000 : 500;
  
        setTimeout(async () => {
            if (state.enabled) {
                await this.applyWithRetry();
                observerManager.setup();
            }
            uiManager.setup();
            navigationManager.init();
            this.setupEventListeners();
      
            utils.log(`Initialization complete. Status: ${state.enabled ? 'ENABLED ✅' : 'DISABLED ❌'}`, 'success');
        }, initialDelay);
    },
  
    async applyWithRetry() {
        if (!state.enabled) return;

        for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
            try {
                utils.log(`Apply attempt ${attempt}/${CONFIG.MAX_RETRIES}`, 'debug');
          
                if (await styleManager.apply()) {
                    utils.log('Styles successfully applied from GitHub!', 'success');
                    return;
                }
            } catch (error) {
                utils.log(`Attempt ${attempt} error: ${error.message}`, 'error');
            }

            if (attempt < CONFIG.MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
            }
        }
  
        utils.log('Max retries reached', 'warning');
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

// 🏁 Start the application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

})();
