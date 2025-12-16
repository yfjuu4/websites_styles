// ==UserScript==
// @name         Universal AI Chat Styler (Berry Browser Compatible)
// @namespace    http://yourdomain.example
// @version      3.6
// @description  Load custom CSS for ChatGPT, Claude AI, Google Search, GitHub, Facebook, Twitter/X, and Stack Overflow via jsDelivr - Berry Browser Optimized
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://www.google.com/*
// @match        https://google.com/*
// @match        https://*.google.com/*
// @match        https://github.com/*
// @match        https://*.github.com/*
// @match        https://www.facebook.com/*
// @match        https://facebook.com/*
// @match        https://*.facebook.com/*
// @match        https://m.facebook.com/*
// @match        https://x.com/*
// @match        https://*.x.com/*
// @match        https://twitter.com/*
// @match        https://*.twitter.com/*
// @match        https://stackoverflow.com/*
// @match        https://*.stackoverflow.com/*
// @grant        GM_xmlhttpRequest
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
    CACHE_DURATION: 12 * 60 * 60 * 1000,
    CACHE_KEY_PREFIX: 'css_cache_',
    BERRY_INITIAL_DELAY: 4000,
    CHATGPT_READY_CHECK_INTERVAL: 200,
    CHATGPT_MAX_READY_CHECKS: 30,
    GOOGLE_DELAY: 2000,
    GITHUB_DELAY: 1500,
    FACEBOOK_DELAY: 2500,
    TWITTER_DELAY: 1800,
    STACKOVERFLOW_DELAY: 1200  // 🆕 Stack Overflow delay
};

// 🎨 Site configuration with jsDelivr URLs
const SITES = {
    'chatgpt.com': {
        name: 'ChatGPT',
        styleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/ChatGpt_style.css',
        fallbackURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/ChatGpt_style.css',
        styleID: 'chatgpt-enhanced-styles',
        needsReadyCheck: true,
        readySelector: 'main, [class*="conversation"], #__next',
        aggressiveReapply: true
    },
    'claude.ai': {
        name: 'Claude AI',
        styleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/Claude_AI_style.css',
        fallbackURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/Claude_AI_style.css',
        styleID: 'claude-enhanced-styles',
        needsReadyCheck: false,
        readySelector: 'body',
        aggressiveReapply: false
    },
    'www.google.com': {
        name: 'Google Search',
        styleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/google%20Search%20engine.css',
        fallbackURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/google%20Search%20engine.css',
        styleID: 'google-enhanced-styles',
        needsReadyCheck: false,
        readySelector: 'body, #searchform, form[action="/search"], input[name="q"]',
        aggressiveReapply: false,
        isGoogle: true,
        searchSelectors: ['#searchform', 'form[action="/search"]', '[name="q"]']
    },
    'google.com': {
        name: 'Google Search',
        styleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/google%20Search%20engine.css',
        fallbackURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/google%20Search%20engine.css',
        styleID: 'google-enhanced-styles',
        needsReadyCheck: false,
        readySelector: 'body, #searchform, form[action="/search"], input[name="q"]',
        aggressiveReapply: false,
        isGoogle: true,
        searchSelectors: ['#searchform', 'form[action="/search"]', '[name="q"]']
    },
    'github.com': {
        name: 'GitHub',
        styleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/github%20style.css',
        fallbackURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/github%20style.css',
        styleID: 'github-enhanced-styles',
        needsReadyCheck: true,
        readySelector: 'body, .application-main, #js-repo-pjax-container, [data-turbo-body]',
        aggressiveReapply: true,
        isGitHub: true,
        pageSelectors: {
            'dashboard': '.dashboard',
            'repository': '.repository-content',
            'profile': '.user-profile',
            'explore': '.explore-content',
            'marketplace': '.marketplace-content',
            'issues': '.issues-listing',
            'pull_requests': '.pull-requests-listing'
        }
    },
    'www.facebook.com': {
        name: 'Facebook',
        styleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/Facebook_style.css',
        fallbackURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/Facebook_style.css',
        styleID: 'facebook-enhanced-styles',
        needsReadyCheck: true,
        readySelector: 'body, #facebook, [role="main"], [data-pagelet], ._2s1x',
        aggressiveReapply: true,
        isFacebook: true,
        pageSelectors: {
            'home': '[data-pagelet="root"]',
            'profile': '[data-pagelet="ProfileTimeline"]',
            'messages': '[data-pagelet="MessagingWindow"]',
            'notifications': '[data-pagelet="NotificationsFlyout"]',
            'watch': '[data-pagelet="VideoHomePage"]',
            'marketplace': '[data-pagelet="MarketplacePage"]',
            'groups': '[data-pagelet="GroupsPage"]'
        }
    },
    'x.com': {
        name: 'Twitter/X',
        styleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/twitter%20style.css',
        fallbackURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/twitter%20style.css',
        styleID: 'twitter-enhanced-styles',
        needsReadyCheck: true,
        readySelector: 'body, [data-testid="primaryColumn"], [role="main"], [data-testid="AppTabBar_Home_Link"]',
        aggressiveReapply: true,
        isTwitter: true,
        pageSelectors: {
            'home': '[data-testid="primaryColumn"]',
            'explore': '[data-testid="Explore"]',
            'notifications': '[data-testid="Notifications"]',
            'messages': '[data-testid="DMDrawer"]',
            'profile': '[data-testid="primaryColumn"] [data-testid="UserProfileHeader_Items"]',
            'search': '[data-testid="searchFilters"]',
            'lists': '[data-testid="lists"]'
        }
    },
    // 🆕 Stack Overflow configuration
    'stackoverflow.com': {
        name: 'Stack Overflow',
        styleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/Stack%20Overflow%20style.css',
        fallbackURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/Stack%20Overflow%20style.css',
        styleID: 'stackoverflow-enhanced-styles',
        needsReadyCheck: true,
        readySelector: 'body, #content, .container, .s-topbar, .js-search-input',
        aggressiveReapply: true,
        isStackOverflow: true,
        pageSelectors: {
            'questions': '#questions',
            'question': '.question',
            'answers': '#answers',
            'ask': '.ask-page',
            'users': '.user-page',
            'tags': '.tags-page',
            'jobs': '.jobs-page',
            'search': '.search-results'
        }
    }
};

// 🏗️ Enhanced site detection
function detectCurrentSite() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    // Direct domain match
    if (SITES[hostname]) {
        return SITES[hostname];
    }

    // Handle all Google domains
    if (hostname.includes('google.')) {
        const isSearchPage = pathname === '/search' ||
                            pathname === '/' ||
                            document.querySelector('input[name="q"]') ||
                            document.querySelector('form[action*="/search"]');
    
        if (isSearchPage) {
            return {
                name: 'Google Search',
                styleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/google%20Search%20engine.css',
                fallbackURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/google%20Search%20engine.css',
                styleID: 'google-enhanced-styles',
                needsReadyCheck: false,
                readySelector: 'body, #searchform, form[action="/search"], input[name="q"]',
                aggressiveReapply: false,
                isGoogle: true,
                searchSelectors: ['#searchform', 'form[action="/search"]', '[name="q"]']
            };
        }
    }

    // Handle GitHub domains
    if (hostname.includes('github.')) {
        return {
            name: 'GitHub',
            styleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/github%20style.css',
            fallbackURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/github%20style.css',
            styleID: 'github-enhanced-styles',
            needsReadyCheck: true,
            readySelector: 'body, .application-main, #js-repo-pjax-container, [data-turbo-body]',
            aggressiveReapply: true,
            isGitHub: true,
            pageSelectors: {
                'dashboard': '.dashboard',
                'repository': '.repository-content',
                'profile': '.user-profile',
                'explore': '.explore-content',
                'marketplace': '.marketplace-content',
                'issues': '.issues-listing',
                'pull_requests': '.pull-requests-listing'
            }
        };
    }

    // Handle Facebook domains
    if (hostname.includes('facebook.')) {
        return {
            name: 'Facebook',
            styleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/Facebook_style.css',
            fallbackURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/Facebook_style.css',
            styleID: 'facebook-enhanced-styles',
            needsReadyCheck: true,
            readySelector: 'body, #facebook, [role="main"], [data-pagelet], ._2s1x',
            aggressiveReapply: true,
            isFacebook: true,
            pageSelectors: {
                'home': '[data-pagelet="root"]',
                'profile': '[data-pagelet="ProfileTimeline"]',
                'messages': '[data-pagelet="MessagingWindow"]',
                'notifications': '[data-pagelet="NotificationsFlyout"]',
                'watch': '[data-pagelet="VideoHomePage"]',
                'marketplace': '[data-pagelet="MarketplacePage"]',
                'groups': '[data-pagelet="GroupsPage"]'
            }
        };
    }

    // Handle Twitter/X domains
    if (hostname.includes('x.com') || hostname.includes('twitter.com')) {
        return {
            name: 'Twitter/X',
            styleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/twitter%20style.css',
            fallbackURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/twitter%20style.css',
            styleID: 'twitter-enhanced-styles',
            needsReadyCheck: true,
            readySelector: 'body, [data-testid="primaryColumn"], [role="main"], [data-testid="AppTabBar_Home_Link"]',
            aggressiveReapply: true,
            isTwitter: true,
            pageSelectors: {
                'home': '[data-testid="primaryColumn"]',
                'explore': '[data-testid="Explore"]',
                'notifications': '[data-testid="Notifications"]',
                'messages': '[data-testid="DMDrawer"]',
                'profile': '[data-testid="primaryColumn"] [data-testid="UserProfileHeader_Items"]',
                'search': '[data-testid="searchFilters"]',
                'lists': '[data-testid="lists"]'
            }
        };
    }

    // 🆕 Handle Stack Overflow domains
    if (hostname.includes('stackoverflow.')) {
        return {
            name: 'Stack Overflow',
            styleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/Stack%20Overflow%20style.css',
            fallbackURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/Stack%20Overflow%20style.css',
            styleID: 'stackoverflow-enhanced-styles',
            needsReadyCheck: true,
            readySelector: 'body, #content, .container, .s-topbar, .js-search-input',
            aggressiveReapply: true,
            isStackOverflow: true,
            pageSelectors: {
                'questions': '#questions',
                'question': '.question',
                'answers': '#answers',
                'ask': '.ask-page',
                'users': '.user-page',
                'tags': '.tags-page',
                'jobs': '.jobs-page',
                'search': '.search-results'
            }
        };
    }

    return null;
}

const currentSite = detectCurrentSite();

if (!currentSite) {
    console.log('AI Chat Styler: No configuration found for this page');
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

    const userAgent = navigator.userAgent.toLowerCase();
    state.isBerryBrowser = !state.hasGrants && /android/.test(userAgent);

    if (state.isBerryBrowser) {
        console.log('🍓 Berry Browser detected - using fallback methods');
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
            'google': '🔍',
            'github': '🐙',
            'facebook': '👤',
            'twitter': '🐦',
            'stackoverflow': '💻'
        }[level] || 'ℹ️';
   
        const prefix = state.isBerryBrowser ? `${emoji}🍓` : emoji;
     
        let siteIcon = '🎨';
        if (state.site.isGoogle) siteIcon = '🔍';
        if (state.site.isGitHub) siteIcon = '🐙';
        if (state.site.isFacebook) siteIcon = '👤';
        if (state.site.isTwitter) siteIcon = '🐦';
        if (state.site.isStackOverflow) siteIcon = '💻';
     
        console.log(`${prefix}${siteIcon} [${currentSite.name}] ${message}`);
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
    
        if (state.site.isGoogle) {
            for (const selector of state.site.searchSelectors) {
                const element = await this.waitForElement(selector, 5000);
                if (element) {
                    this.log('Google search page is ready', 'success');
                
                    if (state.isBerryBrowser) {
                        this.log('Applying Google Berry Browser delay...', 'debug');
                        await new Promise(resolve => setTimeout(resolve, CONFIG.GOOGLE_DELAY));
                    }
                
                    return true;
                }
            }
            this.log('Google search elements not found, continuing anyway', 'warning');
            return true;
        }
     
        // GitHub handling
        if (state.site.isGitHub) {
            this.log('Detecting GitHub page type...', 'debug');
         
            for (const selector of state.site.readySelector.split(', ')) {
                const element = await this.waitForElement(selector, 7000);
                if (element) {
                    this.log(`GitHub ${selector} found`, 'debug');
                 
                    if (state.isBerryBrowser) {
                        this.log('Applying GitHub Berry Browser delay...', 'debug');
                        await new Promise(resolve => setTimeout(resolve, CONFIG.GITHUB_DELAY));
                    }
                 
                    await new Promise(resolve => setTimeout(resolve, 500));
                    return true;
                }
            }
         
            for (const [pageType, selector] of Object.entries(state.site.pageSelectors)) {
                const element = document.querySelector(selector);
                if (element) {
                    this.log(`Found GitHub ${pageType} page`, 'success');
                    return true;
                }
            }
         
            this.log('GitHub page ready check timed out, continuing anyway', 'warning');
            return true;
        }

        // Facebook handling
        if (state.site.isFacebook) {
            this.log('Waiting for Facebook page to be ready...', 'debug');
          
            const facebookSelectors = [
                '#facebook',
                '[role="main"]',
                '[data-pagelet]',
                '._2s1x',
                'div[class*="x1iyjqo2"]'
            ];
          
            for (const selector of facebookSelectors) {
                const element = await this.waitForElement(selector, 8000);
                if (element) {
                    this.log(`Facebook element found: ${selector}`, 'debug');
                  
                    if (state.isBerryBrowser) {
                        this.log('Applying Facebook Berry Browser delay...', 'debug');
                        await new Promise(resolve => setTimeout(resolve, CONFIG.FACEBOOK_DELAY));
                    }
                  
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return true;
                }
            }
          
            for (const [pageType, selector] of Object.entries(state.site.pageSelectors)) {
                const element = document.querySelector(selector);
                if (element) {
                    this.log(`Found Facebook ${pageType} page`, 'success');
                    return true;
                }
            }
          
            this.log('Facebook page ready check timed out, continuing anyway', 'warning');
            return true;
        }

        // Twitter/X handling
        if (state.site.isTwitter) {
            this.log('Waiting for Twitter/X page to be ready...', 'debug');
           
            const twitterSelectors = [
                '[data-testid="primaryColumn"]',
                '[role="main"]',
                '[data-testid="AppTabBar_Home_Link"]',
                '[data-testid="SideNav_AccountSwitcher_Button"]',
                'article[data-testid="tweet"]'
            ];
           
            for (const selector of twitterSelectors) {
                const element = await this.waitForElement(selector, 6000);
                if (element) {
                    this.log(`Twitter/X element found: ${selector}`, 'debug');
                   
                    if (state.isBerryBrowser) {
                        this.log('Applying Twitter/X Berry Browser delay...', 'debug');
                        await new Promise(resolve => setTimeout(resolve, CONFIG.TWITTER_DELAY));
                    }
                   
                    await new Promise(resolve => setTimeout(resolve, 700));
                    return true;
                }
            }
           
            for (const [pageType, selector] of Object.entries(state.site.pageSelectors)) {
                const element = document.querySelector(selector);
                if (element) {
                    this.log(`Found Twitter/X ${pageType} page`, 'success');
                    return true;
                }
            }
           
            this.log('Twitter/X page ready check timed out, continuing anyway', 'warning');
            return true;
        }

        // 🆕 Stack Overflow handling
        if (state.site.isStackOverflow) {
            this.log('Waiting for Stack Overflow page to be ready...', 'debug');
            
            const stackOverflowSelectors = [
                '#content',
                '.container',
                '.s-topbar',
                '.js-search-input',
                '#question-header',
                '.question'
            ];
            
            for (const selector of stackOverflowSelectors) {
                const element = await this.waitForElement(selector, 6000);
                if (element) {
                    this.log(`Stack Overflow element found: ${selector}`, 'debug');
                    
                    if (state.isBerryBrowser) {
                        this.log('Applying Stack Overflow Berry Browser delay...', 'debug');
                        await new Promise(resolve => setTimeout(resolve, CONFIG.STACKOVERFLOW_DELAY));
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 300));
                    return true;
                }
            }
            
            for (const [pageType, selector] of Object.entries(state.site.pageSelectors)) {
                const element = document.querySelector(selector);
                if (element) {
                    this.log(`Found Stack Overflow ${pageType} page`, 'success');
                    return true;
                }
            }
            
            this.log('Stack Overflow page ready check timed out, continuing anyway', 'warning');
            return true;
        }

        const element = await this.waitForElement(state.site.readySelector, 10000);

        if (element) {
            this.log('Page is ready', 'success');
   
            if (state.isBerryBrowser && state.site.name === 'ChatGPT') {
                this.log('Applying ChatGPT Berry Browser delay...', 'debug');
                await new Promise(resolve => setTimeout(resolve, CONFIG.BERRY_INITIAL_DELAY));
            }
   
            return true;
        }

        this.log('Page ready check timed out, continuing anyway', 'warning');
        return false;
    }
};

// 📥 CSS loader optimized for Berry Browser (keep original)
const cssLoader = {
    async fetchExternalCSS() {
        state.fetchAttempts++;
   
        const cachedCSS = utils.getCachedCSS();
        if (cachedCSS) {
            state.cssContent = cachedCSS;
            return cachedCSS;
        }

        utils.log(`Fetch attempt #${state.fetchAttempts}`, 'info');
        utils.log(`Primary URL: ${state.site.styleURL}`, 'debug');
   
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
                throw new Error(`Could not fetch CSS from any source`);
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
        utils.log('Trying direct fetch...', 'debug');
   
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
   
        utils.log(`Fetched ${css.length} chars directly`, 'success');
        return css;
    },

    async fetchForBerryBrowser() {
        utils.log('Berry: Starting optimized fetch...', 'berry');
   
        const strategies = [
            { url: state.site.styleURL, mode: 'no-cors', desc: 'jsDelivr no-cors' },
            { url: state.site.styleURL, mode: 'cors', desc: 'jsDelivr cors' },
            { url: state.site.fallbackURL, mode: 'no-cors', desc: 'GitHub no-cors' },
            { url: state.site.fallbackURL, mode: 'cors', desc: 'GitHub cors' }
        ];
   
        for (const strategy of strategies) {
            if (!strategy.url) continue;
       
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
   
        throw new Error('All Berry strategies failed');
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
                utils.log(`Trying proxy ${i + 1}/${proxies.length}`, 'debug');
           
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

// 🎨 Style manager (keep original)
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
                utils.log('Fetching CSS...', 'info');
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

// 👁️ Observer manager (keep original)
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

            // Special handling for Facebook's React updates
            if (state.site.isFacebook) {
                for (const mutation of mutations) {
                    if (mutation.removedNodes.length > 0) {
                        for (const node of mutation.removedNodes) {
                            if (node.id === state.site.styleID) {
                                shouldReapply = true;
                                break;
                            }
                        }
                    }
                  
                    if (mutation.target && mutation.target.id === 'facebook') {
                        shouldReapply = true;
                    }
                }
            } else {
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
            }

            if (shouldReapply) {
                throttledReapply();
            }
        });

        const observeTarget = state.site.isFacebook ? document.body : document.head;
        const observeOptions = state.site.isFacebook ? {
            childList: true,
            subtree: true
        } : {
            childList: true,
            subtree: false
        };

        state.observer.observe(observeTarget, observeOptions);
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

// 📱 Floating button for Berry Browser
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

        let icon;
        if (state.site.isGoogle) {
            icon = state.enabled ? '🔍' : '🔎';
        } else if (state.site.isGitHub) {
            icon = state.enabled ? '🐙' : '⚫';
        } else if (state.site.isFacebook) {
            icon = state.enabled ? '👤' : '🙈';
        } else if (state.site.isTwitter) {
            icon = state.enabled ? '🐦' : '🚫';
        } else if (state.site.isStackOverflow) {
            icon = state.enabled ? '💻' : '🖥️';
        } else {
            icon = state.enabled ? '🎨' : '🚫';
        }

        button.innerHTML = icon;
        button.style.opacity = state.enabled ? '1' : '0.6';
        button.title = `${state.site.name}: ${state.enabled ? 'ON' : 'OFF'}`;
     
        // Set background based on site
        if (state.site.isGitHub) {
            button.style.background = state.enabled
                ? 'linear-gradient(135deg, #24292e 0%, #2dba4e 100%)'
                : 'linear-gradient(135deg, #666 0%, #999 100%)';
        } else if (state.site.isGoogle) {
            button.style.background = state.enabled
                ? 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)'
                : 'linear-gradient(135deg, #666 0%, #999 100%)';
        } else if (state.site.isFacebook) {
            button.style.background = state.enabled
                ? 'linear-gradient(135deg, #1877F2 0%, #0d8bf0 100%)'
                : 'linear-gradient(135deg, #666 0%, #999 100%)';
        } else if (state.site.isTwitter) {
            button.style.background = state.enabled
                ? 'linear-gradient(135deg, #000000 0%, #1DA1F2 100%)'
                : 'linear-gradient(135deg, #666 0%, #999 100%)';
        } else if (state.site.isStackOverflow) {
            button.style.background = state.enabled
                ? 'linear-gradient(135deg, #F48024 0%, #BCBBBB 100%)'
                : 'linear-gradient(135deg, #666 0%, #999 100%)';
        } else {
            button.style.background = state.enabled
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'linear-gradient(135deg, #666 0%, #999 100%)';
        }

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
URL: ${state.site.styleURL}
Enabled: ${state.enabled}
Fetch Attempts: ${state.fetchAttempts}
CSS Content: ${state.cssContent ? state.cssContent.length + ' chars' : 'None'}
Applied Method: ${state.appliedMethod || 'None'}
Style Applied: ${styleManager.isApplied()}
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
        utils.log(`🚀 Initializing ${state.site.name} Styler v3.6`, 'info');
        utils.log(`Mode: ${state.isBerryBrowser ? '🍓 Berry Browser' : 'Standard'}`, 'info');

        this.addPulseAnimation();

        let initialDelay = state.isBerryBrowser ? 2000 : 500;
        if (state.site.isGoogle && state.isBerryBrowser) {
            initialDelay = CONFIG.GOOGLE_DELAY;
        }
        if (state.site.isGitHub && state.isBerryBrowser) {
            initialDelay = CONFIG.GITHUB_DELAY;
        }
        if (state.site.isFacebook && state.isBerryBrowser) {
            initialDelay = CONFIG.FACEBOOK_DELAY;
        }
        if (state.site.isTwitter && state.isBerryBrowser) {
            initialDelay = CONFIG.TWITTER_DELAY;
        }
        if (state.site.isStackOverflow && state.isBerryBrowser) {
            initialDelay = CONFIG.STACKOVERFLOW_DELAY;
        }

        setTimeout(async () => {
            await this.applyWithRetry();
            observerManager.setup();
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
