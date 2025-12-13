// ==UserScript==
// @name         Universal AI Chat Styler - CSP Workaround Edition
// @namespace    http://yourdomain.example
// @version      3.0
// @description  CSP-compliant CSS loader for ChatGPT and Claude AI in Berry Browser
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
'use strict';

// Configuration
const CONFIG = {
    DEBUG_MODE: true,
    CACHE_DURATION: 12 * 60 * 60 * 1000, // 12 hours
    CACHE_KEY_PREFIX: 'css_cache_v3_',
    FETCH_TIMEOUT: 10000,
    MAX_RETRIES: 3
};

// Site configuration
const SITES = {
    'chatgpt.com': {
        name: 'ChatGPT',
        cssURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/ChatGpt_style.css',
        styleID: 'chatgpt-enhanced-styles',
        enabledKey: 'chatgpt_styles_enabled'
    },
    'claude.ai': {
        name: 'Claude AI',
        cssURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/ChatGpt_style.css',
        styleID: 'claude-enhanced-styles',
        enabledKey: 'claude_styles_enabled'
    }
};

const currentSite = SITES[window.location.hostname];
if (!currentSite) return;

// State
const state = {
    cssContent: null,
    isEnabled: true,
    isFetching: false
};

// Utility functions
const utils = {
    log(message, level = 'info') {
        if (!CONFIG.DEBUG_MODE && level === 'debug') return;
        const emoji = {'info': 'ℹ️', 'success': '✅', 'error': '❌', 'debug': '🔍'}[level] || 'ℹ️';
        console.log(`${emoji} [${currentSite.name}] ${message}`);
    },

    getFromCache() {
        try {
            const cacheKey = CONFIG.CACHE_KEY_PREFIX + currentSite.name;
            const cached = localStorage.getItem(cacheKey);
            if (!cached) return null;

            const { css, timestamp, url } = JSON.parse(cached);
            
            if (url !== currentSite.cssURL) {
                this.log('Cache URL mismatch', 'debug');
                return null;
            }

            if (Date.now() - timestamp > CONFIG.CACHE_DURATION) {
                this.log('Cache expired', 'debug');
                return null;
            }

            this.log(`Using cached CSS (${css.length} chars)`, 'success');
            return css;
        } catch (e) {
            this.log(`Cache read error: ${e.message}`, 'error');
            return null;
        }
    },

    saveToCache(css) {
        try {
            const cacheKey = CONFIG.CACHE_KEY_PREFIX + currentSite.name;
            const cacheData = {
                css: css,
                timestamp: Date.now(),
                url: currentSite.cssURL
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            this.log('CSS cached successfully', 'debug');
        } catch (e) {
            this.log(`Cache write error: ${e.message}`, 'error');
        }
    },

    getEnabled() {
        try {
            const value = localStorage.getItem(currentSite.enabledKey);
            return value === null ? true : JSON.parse(value);
        } catch (e) {
            return true;
        }
    },

    setEnabled(enabled) {
        try {
            localStorage.setItem(currentSite.enabledKey, JSON.stringify(enabled));
            state.isEnabled = enabled;
        } catch (e) {
            this.log(`Failed to save enabled state: ${e.message}`, 'error');
        }
    }
};

// CSS Fetcher - The KEY solution for CSP bypass
const cssFetcher = {
    // Method 1: Fetch via iframe in a different context (before CSP loads)
    async fetchViaIframe() {
        utils.log('Attempting iframe fetch method...', 'debug');
        
        return new Promise((resolve, reject) => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.sandbox = 'allow-same-origin allow-scripts';
            
            // Use a data URL with fetch capability
            iframe.src = 'about:blank';
            
            const cleanup = () => {
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
            };
            
            iframe.onload = () => {
                try {
                    const iframeWindow = iframe.contentWindow;
                    
                    if (!iframeWindow || !iframeWindow.fetch) {
                        cleanup();
                        reject(new Error('Iframe fetch not available'));
                        return;
                    }
                    
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT);
                    
                    iframeWindow.fetch(currentSite.cssURL, {
                        signal: controller.signal,
                        mode: 'cors',
                        cache: 'no-cache'
                    })
                    .then(response => {
                        clearTimeout(timeoutId);
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        return response.text();
                    })
                    .then(css => {
                        cleanup();
                        utils.log(`Iframe fetch success (${css.length} chars)`, 'success');
                        resolve(css);
                    })
                    .catch(error => {
                        clearTimeout(timeoutId);
                        cleanup();
                        reject(error);
                    });
                    
                } catch (error) {
                    cleanup();
                    reject(error);
                }
            };
            
            iframe.onerror = () => {
                cleanup();
                reject(new Error('Iframe load failed'));
            };
            
            // Append iframe to trigger load
            (document.documentElement || document.body || document).appendChild(iframe);
            
            // Fallback timeout
            setTimeout(() => {
                cleanup();
                reject(new Error('Iframe method timeout'));
            }, CONFIG.FETCH_TIMEOUT);
        });
    },

    // Method 2: XMLHttpRequest (sometimes bypasses CSP differently than fetch)
    async fetchViaXHR() {
        utils.log('Attempting XHR fetch method...', 'debug');
        
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.timeout = CONFIG.FETCH_TIMEOUT;
            
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const css = xhr.responseText;
                    if (css && css.trim().length > 0) {
                        utils.log(`XHR fetch success (${css.length} chars)`, 'success');
                        resolve(css);
                    } else {
                        reject(new Error('Empty response'));
                    }
                } else {
                    reject(new Error(`HTTP ${xhr.status}`));
                }
            };
            
            xhr.onerror = () => reject(new Error('XHR network error'));
            xhr.ontimeout = () => reject(new Error('XHR timeout'));
            
            try {
                xhr.open('GET', currentSite.cssURL, true);
                xhr.send();
            } catch (error) {
                reject(error);
            }
        });
    },

    // Method 3: Use a JSONP-like approach with script injection
    async fetchViaScript() {
        utils.log('Attempting script injection method...', 'debug');
        
        return new Promise((resolve, reject) => {
            const callbackName = 'cssCallback_' + Date.now();
            const script = document.createElement('script');
            
            // This won't work for direct CSS, but serves as a fallback pattern
            // In practice, you'd need a JSONP endpoint
            reject(new Error('Script method not applicable for direct CSS'));
        });
    },

    // Method 4: Early fetch before CSP is enforced
    async fetchEarly() {
        utils.log('Attempting early fetch (before CSP)...', 'debug');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT);
        
        try {
            const response = await fetch(currentSite.cssURL, {
                method: 'GET',
                signal: controller.signal,
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'omit'
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const css = await response.text();
            utils.log(`Early fetch success (${css.length} chars)`, 'success');
            return css;
            
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    },

    // Main fetch orchestrator
    async fetchCSS() {
        if (state.isFetching) {
            utils.log('Fetch already in progress', 'debug');
            return null;
        }

        state.isFetching = true;

        // Try cache first
        const cached = utils.getFromCache();
        if (cached) {
            state.isFetching = false;
            return cached;
        }

        // Try multiple methods in order
        const methods = [
            { name: 'early', fn: () => this.fetchEarly() },
            { name: 'xhr', fn: () => this.fetchViaXHR() },
            { name: 'iframe', fn: () => this.fetchViaIframe() }
        ];

        for (let retry = 0; retry < CONFIG.MAX_RETRIES; retry++) {
            for (const method of methods) {
                try {
                    utils.log(`Attempt ${retry + 1}/${CONFIG.MAX_RETRIES}: ${method.name}`, 'debug');
                    const css = await method.fn();
                    
                    if (css && css.trim().length > 0) {
                        utils.saveToCache(css);
                        state.isFetching = false;
                        return css;
                    }
                } catch (error) {
                    utils.log(`${method.name} failed: ${error.message}`, 'debug');
                }
            }
            
            if (retry < CONFIG.MAX_RETRIES - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
            }
        }

        state.isFetching = false;
        utils.log('All fetch methods failed', 'error');
        return null;
    }
};

// Style injector
const styleInjector = {
    inject(css) {
        if (!css || css.trim().length === 0) {
            utils.log('No CSS to inject', 'error');
            return false;
        }

        try {
            // Remove existing style if present
            const existing = document.getElementById(currentSite.styleID);
            if (existing) {
                existing.remove();
            }

            // Create style element with inline CSS (CSP allows this)
            const style = document.createElement('style');
            style.id = currentSite.styleID;
            style.type = 'text/css';
            style.textContent = css;
            style.setAttribute('data-source', 'berry-styler');

            // Inject into head (create if needed)
            const target = document.head || document.documentElement;
            target.appendChild(style);

            utils.log(`CSS injected successfully (${css.length} chars)`, 'success');
            
            // Verify injection
            setTimeout(() => {
                const verified = document.getElementById(currentSite.styleID);
                if (verified) {
                    utils.log('CSS injection verified ✓', 'success');
                } else {
                    utils.log('CSS injection verification failed', 'error');
                }
            }, 500);

            return true;
        } catch (error) {
            utils.log(`Injection failed: ${error.message}`, 'error');
            return false;
        }
    },

    remove() {
        const element = document.getElementById(currentSite.styleID);
        if (element) {
            element.remove();
            utils.log('CSS removed', 'debug');
        }
    }
};

// Main application
const app = {
    async init() {
        utils.log(`🚀 Initializing ${currentSite.name} Styler v3.0`, 'info');
        
        state.isEnabled = utils.getEnabled();
        
        if (!state.isEnabled) {
            utils.log('Styles disabled by user', 'info');
            return;
        }

        // Start fetching immediately (before CSP can block)
        this.startFetch();
        
        // Setup UI controls
        this.setupControls();
        
        // Watch for dynamic navigation
        this.watchNavigation();
    },

    async startFetch() {
        try {
            utils.log('Starting CSS fetch...', 'info');
            
            const css = await cssFetcher.fetchCSS();
            
            if (css) {
                state.cssContent = css;
                
                // Wait for DOM to be ready
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => {
                        styleInjector.inject(css);
                    });
                } else {
                    styleInjector.inject(css);
                }
            } else {
                utils.log('Failed to fetch CSS', 'error');
                this.showNotification('Failed to load styles');
            }
        } catch (error) {
            utils.log(`Init error: ${error.message}`, 'error');
        }
    },

    setupControls() {
        // Wait for body
        const addControls = () => {
            if (!document.body) {
                setTimeout(addControls, 100);
                return;
            }

            // Toggle button
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'berry-styler-toggle';
            toggleBtn.innerHTML = state.isEnabled ? '🎨' : '🚫';
            toggleBtn.title = `${currentSite.name} Styles: ${state.isEnabled ? 'ON' : 'OFF'}`;
            toggleBtn.style.cssText = `
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
                z-index: 2147483647;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s;
                opacity: ${state.isEnabled ? '1' : '0.6'};
            `;

            toggleBtn.onclick = () => this.toggle();
            document.body.appendChild(toggleBtn);

            // Refresh button (for manual cache clear + reload)
            const refreshBtn = document.createElement('button');
            refreshBtn.innerHTML = '🔄';
            refreshBtn.title = 'Reload CSS';
            refreshBtn.style.cssText = toggleBtn.style.cssText + 'bottom: 80px;';
            refreshBtn.onclick = () => this.refresh();
            document.body.appendChild(refreshBtn);
        };

        addControls();
    },

    toggle() {
        state.isEnabled = !state.isEnabled;
        utils.setEnabled(state.isEnabled);

        if (state.isEnabled) {
            if (state.cssContent) {
                styleInjector.inject(state.cssContent);
            } else {
                this.startFetch();
            }
        } else {
            styleInjector.remove();
        }

        this.updateButton();
        this.showNotification(`Styles: ${state.isEnabled ? 'ON' : 'OFF'}`);
    },

    async refresh() {
        utils.log('Manual refresh triggered', 'info');
        
        // Clear cache
        try {
            const cacheKey = CONFIG.CACHE_KEY_PREFIX + currentSite.name;
            localStorage.removeItem(cacheKey);
            utils.log('Cache cleared', 'debug');
        } catch (e) {
            utils.log(`Cache clear error: ${e.message}`, 'error');
        }

        state.cssContent = null;
        styleInjector.remove();

        if (state.isEnabled) {
            this.showNotification('Reloading CSS...');
            await this.startFetch();
        }
    },

    updateButton() {
        const btn = document.getElementById('berry-styler-toggle');
        if (btn) {
            btn.innerHTML = state.isEnabled ? '🎨' : '🚫';
            btn.style.opacity = state.isEnabled ? '1' : '0.6';
            btn.title = `${currentSite.name} Styles: ${state.isEnabled ? 'ON' : 'OFF'}`;
        }
    },

    showNotification(message) {
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
            z-index: 2147483646;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: opacity 0.3s;
        `;
        toast.textContent = message;

        const addToast = () => {
            if (document.body) {
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    setTimeout(() => toast.remove(), 300);
                }, 2000);
            } else {
                setTimeout(addToast, 100);
            }
        };
        addToast();
    },

    watchNavigation() {
        // Re-inject styles on navigation (for SPAs)
        let lastURL = location.href;
        
        const checkURL = () => {
            if (location.href !== lastURL) {
                lastURL = location.href;
                utils.log('Navigation detected', 'debug');
                
                if (state.isEnabled && state.cssContent) {
                    setTimeout(() => {
                        if (!document.getElementById(currentSite.styleID)) {
                            styleInjector.inject(state.cssContent);
                        }
                    }, 500);
                }
            }
        };

        setInterval(checkURL, 1000);
    }
};

// Initialize immediately at document-start
app.init();

})();
