// ==UserScript==
// @name         Universal AI Chat Styler (Multi-Site) - Berry Optimized
// @namespace    http://yourdomain.example
// @version      2.1.1
// @description  Dynamically load custom CSS for ChatGPT and Claude AI
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
    CACHE_DURATION: 12 * 60 * 60 * 1000, // 12 hours
    CACHE_KEY_PREFIX: 'css_cache_v2_',
    BERRY_INITIAL_DELAY: 3000, // Increased for Berry
    CHATGPT_READY_CHECK_INTERVAL: 200,
    CHATGPT_MAX_READY_CHECKS: 50,
    BERRY_MAX_FETCH_ATTEMPTS: 5
};

// Site configuration with Berry-specific fallback URLs
const SITES = {
    'chatgpt.com': {
        name: 'ChatGPT',
        styleURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/refs/heads/main/ChatGpt%20style.css',
        // Berry Browser fallback URLs (try in order)
        berryFallbackURLs: [
            'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/ChatGpt%20style.css',
            'https://raw.githack.com/yfjuu4/ai-chat-styles/main/ChatGpt%20style.css',
            'https://cdn.statically.io/gh/yfjuu4/ai-chat-styles/main/ChatGpt%20style.css'
        ],
        styleID: 'chatgpt-enhanced-styles',
        enabledKey: 'chatgpt_styles_enabled',
        needsReadyCheck: true,
        // More specific selector for ChatGPT in Berry
        readySelector: 'main, [data-testid^="conversation"], #__next, [class*="conversation"], [class*="Conversation"]',
        aggressiveReapply: true,
        berrySpecificReadyCheck: true,
        berryReadySelector: 'body, main, [role="main"], [data-testid]'
    },
    'claude.ai': {
        name: 'Claude AI',
        styleURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/refs/heads/main/Claude%20AI%20style.css',
        berryFallbackURLs: [
            'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/Claude%20AI%20style.css',
            'https://raw.githack.com/yfjuu4/ai-chat-styles/main/Claude%20AI%20style.css'
        ],
        styleID: 'claude-enhanced-styles',
        enabledKey: 'claude_styles_enabled',
        needsReadyCheck: false,
        readySelector: 'body',
        aggressiveReapply: false
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
    fetchAttempts: 0,
    currentFetchURL: currentSite.styleURL
};

// Enhanced browser detection
(function detectCapabilities() {
    state.hasGrants = typeof GM_xmlhttpRequest !== 'undefined';
 
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|mobile/i.test(userAgent);
    const isChromiumBased = /chrome|chromium/i.test(userAgent);
    
    // Detect Berry Browser specifically
    state.isBerryBrowser = (!state.hasGrants && isMobile && isChromiumBased) ||
                          /berry/i.test(userAgent) ||
                          (typeof GM_info === 'undefined' && !state.hasGrants);
 
    if (state.isBerryBrowser) {
        console.log('🍓 Berry Browser detected - using optimized methods');
        // Use first fallback URL for Berry if available
        if (state.site.berryFallbackURLs && state.site.berryFallbackURLs.length > 0) {
            state.currentFetchURL = state.site.berryFallbackURLs[0];
        }
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
            'warning': '⚠️',
            'berry': '🍓'
        }[level] || 'ℹ️';
     
        const prefix = state.isBerryBrowser && level !== 'berry' ? `${emoji}🍓 ` : `${emoji} `;
        console.log(`${prefix}[${currentSite.name}] ${message}`);
    },

    // ... [Keep existing throttle, safeCall, getValue, setValue functions] ...

    async waitForElement(selector, timeout = 10000) {
        const startTime = Date.now();
        const selectors = Array.isArray(selector) ? selector : [selector];
     
        while (Date.now() - startTime < timeout) {
            for (const sel of selectors) {
                const element = document.querySelector(sel);
                if (element) {
                    this.log(`Found element with selector: ${sel}`, 'debug');
                    return element;
                }
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
     
        this.log(`No element found with selectors: ${selectors.join(', ')}`, 'warning');
        return null;
    },

    async waitForPageReady() {
        if (!state.site.needsReadyCheck) {
            return true;
        }

        this.log('Waiting for page to be ready...', 'debug');
     
        let selectors = [state.site.readySelector];
        
        // Berry-specific ready check for ChatGPT
        if (state.isBerryBrowser && state.site.berrySpecificReadyCheck && state.site.berryReadySelector) {
            selectors = selectors.concat(state.site.berryReadySelector.split(','));
        }
        
        const element = await this.waitForElement(selectors, 15000);
     
        if (element) {
            this.log('Page is ready', 'success');
         
            // Extended delay for Berry Browser
            if (state.isBerryBrowser && currentDomain === 'chatgpt.com') {
                const delay = CONFIG.BERRY_INITIAL_DELAY;
                this.log(`Applying ChatGPT Berry Browser delay (${delay}ms)...`, 'berry');
                await new Promise(resolve => setTimeout(resolve, delay));
            }
         
            return true;
        }
     
        this.log('Page ready check timed out, continuing anyway', 'warning');
        return false;
    },
    
    // Simple fetch for Berry Browser (no CORS proxy complexity)
    simpleFetch(url) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 10000;
            xhr.responseType = 'text';
            
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(xhr.responseText);
                } else {
                    reject(new Error(`HTTP ${xhr.status}`));
                }
            };
            
            xhr.onerror = function() {
                reject(new Error('Network error'));
            };
            
            xhr.ontimeout = function() {
                reject(new Error('Request timeout'));
            };
            
            // Try to bypass caching
            const timestamp = new Date().getTime();
            const separator = url.includes('?') ? '&' : '?';
            const cacheBusterURL = url + separator + '_=' + timestamp;
            
            xhr.send();
        });
    },
    
    // Try multiple URLs for Berry Browser
    async tryMultipleURLs(urls) {
        for (let i = 0; i < urls.length; i++) {
            try {
                this.log(`Trying URL ${i + 1}/${urls.length}: ${urls[i]}`, 'berry');
                const css = await this.simpleFetch(urls[i]);
                if (css && css.trim().length > 0) {
                    this.log(`Successfully fetched from URL ${i + 1}`, 'success');
                    return { css: css, url: urls[i] };
                }
            } catch (error) {
                this.log(`URL ${i + 1} failed: ${error.message}`, 'debug');
                if (i === urls.length - 1) throw error;
            }
        }
        throw new Error('All URLs failed');
    }
};

// Enhanced CSS loader with Berry-specific optimizations
const cssLoader = {
    async fetchExternalCSS() {
        state.fetchAttempts++;
        
        // Cache check
        const cachedCSS = utils.getCachedCSS();
        if (cachedCSS) {
            state.cssContent = cachedCSS;
            return cachedCSS;
        }

        utils.log(`Fetch attempt ${state.fetchAttempts} for CSS`, 'info');
        
        // Berry Browser specific fetching
        if (state.isBerryBrowser) {
            return this.fetchForBerryBrowser();
        }
        
        // Standard browser fetching (keep original logic)
        // ... [Keep original GM_xmlhttpRequest and fetchDirect methods] ...
        
        throw new Error('All fetch methods failed');
    },

    async fetchForBerryBrowser() {
        // Build URL list to try
        const urlsToTry = [state.currentFetchURL];
        
        if (state.site.berryFallbackURLs) {
            urlsToTry.push(...state.site.berryFallbackURLs);
        }
        
        // Remove duplicates
        const uniqueURLs = [...new Set(urlsToTry)];
        
        try {
            const result = await utils.tryMultipleURLs(uniqueURLs);
            state.cssContent = result.css;
            state.currentFetchURL = result.url;
            utils.setCachedCSS(result.css);
            return result.css;
        } catch (error) {
            utils.log(`All Berry Browser fetch attempts failed: ${error.message}`, 'error');
            
            // Last resort: try with different approaches
            return this.lastResortFetch();
        }
    },
    
    async lastResortFetch() {
        utils.log('Trying last resort methods...', 'berry');
        
        // Method 1: Try with different MIME type
        try {
            const response = await fetch(state.currentFetchURL, {
                method: 'GET',
                headers: { 'Accept': 'text/plain,*/*' },
                mode: 'no-cors'
            }).catch(() => null);
            
            if (response) {
                const css = await response.text();
                if (css && css.trim().length > 0) {
                    utils.setCachedCSS(css);
                    state.cssContent = css;
                    return css;
                }
            }
        } catch (e) {}
        
        // Method 2: Try dynamic script injection (for CDN URLs)
        if (state.currentFetchURL.includes('jsdelivr') || 
            state.currentFetchURL.includes('statically') ||
            state.currentFetchURL.includes('githack')) {
            
            return new Promise((resolve) => {
                const script = document.createElement('script');
                script.src = state.currentFetchURL.replace('.css', '.js?callback=styleCallback');
                
                window.styleCallback = function(cssContent) {
                    if (cssContent && typeof cssContent === 'string') {
                        utils.setCachedCSS(cssContent);
                        state.cssContent = cssContent;
                        resolve(cssContent);
                    } else {
                        resolve(null);
                    }
                    delete window.styleCallback;
                };
                
                script.onerror = () => {
                    utils.log('Dynamic script fetch failed', 'debug');
                    resolve(null);
                };
                
                document.head.appendChild(script);
                setTimeout(() => {
                    if (script.parentNode) {
                        script.parentNode.removeChild(script);
                    }
                    resolve(null);
                }, 5000);
            });
        }
        
        throw new Error('Last resort methods failed');
    },
    
    // ... [Keep existing fetchViaGM, fetchDirect, fetchViaCORSProxy methods] ...
};

// Optimized Style Manager for Berry Browser
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
            // Berry-specific: Skip ready check if it's taking too long
            if (state.isBerryBrowser && state.site.name === 'ChatGPT' && state.fetchAttempts > 2) {
                utils.log('Berry Browser: Skipping ready check after multiple attempts', 'berry');
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

            // Simplified injection for Berry Browser
            if (state.isBerryBrowser) {
                return this.berryBrowserInject();
            }

            // ... [Keep original injection methods for non-Berry browsers] ...
            
        } catch (error) {
            utils.log(`Failed to apply styles: ${error.message}`, 'error');
            
            // Berry-specific fallback
            if (state.isBerryBrowser && state.retryCount < CONFIG.BERRY_MAX_FETCH_ATTEMPTS) {
                state.retryCount++;
                utils.log(`Berry Browser retry ${state.retryCount}/${CONFIG.BERRY_MAX_FETCH_ATTEMPTS}`, 'berry');
                state.isLoading = false;
                setTimeout(() => this.apply(), CONFIG.RETRY_DELAY * state.retryCount);
                return false;
            }
            
            state.isLoading = false;
            return false;
        }
    },
    
    berryBrowserInject() {
        try {
            // Method 1: Direct style injection (most reliable for Berry)
            const style = document.createElement('style');
            style.id = state.site.styleID;
            style.type = 'text/css';
            style.textContent = state.cssContent;
            style.setAttribute('data-berry-injected', 'true');
            
            // Try multiple injection points
            const injectionPoints = [
                () => document.head.appendChild(style),
                () => document.body.appendChild(style),
                () => document.documentElement.appendChild(style)
            ];
            
            for (const inject of injectionPoints) {
                try {
                    inject();
                    state.styleElement = style;
                    utils.log('✅ Styles applied via Berry optimized method', 'success');
                    state.isLoading = false;
                    
                    // Force style recalculation
                    setTimeout(() => {
                        if (style.sheet) {
                            style.sheet.disabled = false;
                        }
                    }, 100);
                    
                    return true;
                } catch (e) {
                    continue;
                }
            }
            
            throw new Error('Could not inject style element');
            
        } catch (error) {
            utils.log(`Berry injection failed: ${error.message}`, 'error');
            
            // Emergency fallback: inline the CSS in the first available element
            try {
                const testElement = document.querySelector(state.site.berryReadySelector || 'body');
                if (testElement) {
                    testElement.style.cssText = state.cssContent;
                    utils.log('Applied CSS via inline style as fallback', 'warning');
                    state.isLoading = false;
                    return true;
                }
            } catch (e) {
                // Ignore
            }
            
            return false;
        }
    },
    
    // ... [Keep existing remove, isApplied, forceReapply methods] ...
};

// Berry-specific Observer
const observerManager = {
    setup() {
        this.cleanup();
        if (!utils.getCurrentSiteEnabled()) return;

        if (state.isBerryBrowser) {
            this.createBerryObserver();
        } else if (state.site.aggressiveReapply) {
            this.createAggressiveObserver();
        } else {
            this.createStandardObserver();
        }
     
        utils.log('Observer started', 'debug');
    },
    
    createBerryObserver() {
        // Simple interval-based observer for Berry Browser
        let checkCount = 0;
        const maxChecks = 200; // More checks for Berry
        
        const checkAndReapply = async () => {
            if (checkCount++ > maxChecks) {
                clearInterval(intervalId);
                utils.log('Berry observer stopped after max checks', 'berry');
                return;
            }
            
            // Check if style is still present
            const styleExists = !!document.getElementById(state.site.styleID);
            
            if (!styleExists && utils.getCurrentSiteEnabled()) {
                utils.log('Style missing in Berry, reapplying...', 'berry');
                await styleManager.forceReapply();
            }
            
            // Also check for DOM mutations that might remove our style
            if (document.head && !document.getElementById(state.site.styleID)) {
                const headObserver = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        for (const node of mutation.removedNodes) {
                            if (node.id === state.site.styleID) {
                                utils.log('Style removed from head, reapplying', 'berry');
                                styleManager.forceReapply();
                                break;
                            }
                        }
                    }
                });
                
                headObserver.observe(document.head, { childList: true });
                setTimeout(() => headObserver.disconnect(), 5000);
            }
        };
        
        const intervalId = setInterval(checkAndReapply, 1000);
        
        state.observer = {
            disconnect: () => {
                clearInterval(intervalId);
                utils.log('Berry observer disconnected', 'berry');
            }
        };
    },
    
    // ... [Keep existing createStandardObserver, createAggressiveObserver, cleanup methods] ...
};

// Main initialization with Berry-specific adjustments
const app = {
    async init() {
        utils.log(`🚀 Initializing ${state.site.name} Styler v2.1.1`, 'info');
        utils.log(`Mode: ${state.isBerryBrowser ? 'Berry Browser 🍓' : 'Standard'}`, 'info');
     
        // Berry Browser needs longer initial delay
        const initialDelay = state.isBerryBrowser ? 
            (currentDomain === 'chatgpt.com' ? 3000 : 1000) : 
            500;
     
        // Force DOM ready for Berry
        if (state.isBerryBrowser) {
            this.forceDOMReady();
        }
     
        setTimeout(async () => {
            await this.applyWithRetry();
            observerManager.setup();
            menuManager.setup();
            navigationManager.init();
            this.setupEventListeners();
         
            const status = utils.getCurrentSiteEnabled() ? 'ENABLED ✅' : 'DISABLED ❌';
            utils.log(`Initialization complete. Status: ${status}`, 'success');
            
            // Berry-specific post-init check
            if (state.isBerryBrowser && !styleManager.isApplied()) {
                setTimeout(() => {
                    if (!styleManager.isApplied()) {
                        utils.log('Post-init style check: missing, reapplying', 'berry');
                        styleManager.forceReapply();
                    }
                }, 2000);
            }
        }, initialDelay);
    },
    
    forceDOMReady() {
        // Ensure DOM is interactive for Berry Browser
        if (document.readyState === 'loading') {
            return new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            });
        }
        return Promise.resolve();
    },
    
    async applyWithRetry() {
        if (!utils.getCurrentSiteEnabled()) return;

        // Fewer retries for Berry Browser but with longer delays
        const maxRetries = state.isBerryBrowser ? 
            CONFIG.BERRY_MAX_FETCH_ATTEMPTS : 
            CONFIG.MAX_RETRIES;
        const retryDelay = state.isBerryBrowser ? 
            CONFIG.RETRY_DELAY * 2 : 
            CONFIG.RETRY_DELAY;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                utils.log(`Apply attempt ${attempt}/${maxRetries}`, 
                         state.isBerryBrowser ? 'berry' : 'debug');
             
                if (await styleManager.apply()) {
                    utils.log('Styles successfully applied!', 'success');
                    
                    // Berry-specific: verify style was actually applied
                    if (state.isBerryBrowser) {
                        setTimeout(() => {
                            if (!styleManager.isApplied()) {
                                utils.log('Style verification failed, retrying', 'berry');
                                styleManager.forceReapply();
                            }
                        }, 1000);
                    }
                    
                    return;
                }
            } catch (error) {
                utils.log(`Attempt ${attempt} error: ${error.message}`, 
                         state.isBerryBrowser ? 'berry' : 'error');
            }

            if (attempt < maxRetries) {
                await new Promise(resolve => 
                    setTimeout(resolve, retryDelay * attempt));
            }
        }
     
        utils.log('Max retries reached - styles may not be applied', 
                 state.isBerryBrowser ? 'berry' : 'warning');
    },
    
    // ... [Keep existing setupEventListeners method] ...
};

// Keep existing menuManager, navigationManager implementations
// ... [Keep existing menuManager and navigationManager code] ...

// Start the application with Berry-specific handling
if (state.isBerryBrowser) {
    // Berry Browser often needs to wait for everything
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => app.init(), 500);
        });
    } else {
        setTimeout(() => app.init(), 1000);
    }
} else {
    // Standard browser initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => app.init());
    } else {
        app.init();
    }
}

})();
