// ==UserScript==
// @name Claude AI CSS Styler
// @namespace http://yourdomain.example
// @version 1
// @description Enhanced CSS styling with improved reliability and performance
// @match https://claude.ai/*
// @grant GM_addStyle
// @grant GM_registerMenuCommand
// @grant GM_unregisterMenuCommand
// @grant GM_setValue
// @grant GM_getValue
// @grant GM_log
// @run-at document-end
// ==/UserScript==

(function() {
'use strict';

// Configuration
const CONFIG = {
STYLE_ID: 'chatgpt-enhanced-styles',
DEBUG_MODE: false,
RETRY_DELAY: 100,
MAX_RETRIES: 50,
OBSERVER_THROTTLE: 250
};

const USER_CSS = String.raw`
/*========================================================*/
/* Your CSS styles here */
.md\:px-Mathjax,
.pt-5,
.font-bold,
.flex-1 > .rounded-lg,
div > div:nth-child(1) > .active\:opacity-90,
div > div:nth-child(2) > .active\:opacity-90,
div > div:nth-child(3) > .active\:opacity-90,
.leading-Mathjax.btn-secondary,
[dir=ltr] .\!pr-3:nth-child(1),
.bottom-full .pb-1,
.leading-Mathjax.btn,
.md\:px-\[60px\],
.leading-\[0\] .btn,
.mb-5,
.max-h-\[60vh\] > .text-muted:nth-child(1),
.dark\:border-white\/20:nth-child(1),
[data-testid="conversation-options-button"],
.pe-8:is(:nth-child(1), :nth-child(4), :nth-child(6), :nth-child(8)),
.items-center:nth-child(9),
.bg-token-bg-elevated-secondary.sticky.bottom-0.z-30,
.screen-arch\:sticky,
span:nth-child(26),
.touch\:hidden:nth-child(11),
.group\/scrollport > .mt-5,
a[role="menuitem"],
.gap-6:nth-child(1),
button[data-testid="share-chat-button"],
.pt-\(--sidebar-section-first-margin-top\):nth-child(3),
.sm\:items-center
,.mb-\[var\(--sidebar-collapsed-section-margin-bottom\)\]
,.border-token-border-default
{
    display: none !important;
}
/*-----------------------------------------*/
.bottom-full {
    border: 1px #e10000 solid;
}
.flex > div > .text-sm {
    font-size: 18px;
}
.mb-2 {
    margin-bottom: 0;
}
.pt-2 {
    padding-top: 0;
}
.text-token-text-secondary {
    Color: #d4c4c4;
}
/*-----------------------------------------*/
.max-w-none > .text-token-text-secondary > div {
    Color: #00c811;
    font-size: 18px;
}
.gap-3 {
    gap: 0;
}
.dark\:bg-token-main-surface-secondary:is(.dark *) {
    padding: 0;
}
.mx-auto {
    margin: 0;
}
.text-base:not(.md\:px-4) {
    padding: 0;
}
body {
    background-color: black !important;
}
.h-14 {
    z-index: 9999;
}
.w-full {
    Color: #a49502;
    text-align: Center;
    font-size: 18px;
    font-weight: 600;
}
.py-Mathjax {
    padding-bottom: 5px;
    padding-top: 5px;
}
.prose :where(strong):not(.prose :where(h3)) {
    color: #ce00d9;
    font-weight: 600;
}
.prose :where(h3):not(:where([class~=not-prose] *)) {
    font-weight: 600;
    margin-bottom: 0;
    margin-top: 0;
    Color: #d50000;
    font-size: 18px !important;
}
.xl\:max-w-Mathjax {
    border: 1px solid #0048ff;
}
.grow {
    Color: #00a6cc;
}
.p-3 {
    padding: 0rem;
}
.text-lg {
    border: 1px red solid;
}
.sm\:p-6 {
    padding: 0;
}
tr:nth-child(1) > .text-left {
    border-top: 2px #a30000 solid;
}
[dir=ltr] .text-left {
    text-align: center;
    border-bottom: 2px #0099d8 solid;
    border-right: 2px #0099d8 solid;
    border-left: 2px #0099d8 solid;
    background-color: black;
}
.px-5 {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    border: 2px #0098a3 solid;
    background-color: black;
    align-self: center;
    Color: #01b0bd;
    border-radius: 0.5rem;
}
.inline-block {
    background-color: #a00000;
}
.my-1 {
    margin-bottom: 0rem;
    margin-top: 0rem;
    Color: black !important;
}
#page-header {
    display: none;
}
.rounded {
    border-top: 2px #00a30b solid;
    padding: 0rem;
    background-color: #002236;
    Color: #009c15;
}
.rounded:hover {
    background-color: #9a009c;
    Color: #000;
}
.prose :where(hr):not(:where([class~=not-prose] *)) {
    border: 1px #00810b solid !important;
    border-top-width: 1px;
    margin-bottom: 0em;
    margin-top: 0em;
}
.markdown h3 {
    font-weight: 600;
    margin-bottom: 0.1rem;
    margin-top: 0.1rem;
}
.prose :where(li):not(:where([class~=not-prose] *)) {
    margin-bottom: 0.2rem;
    margin-top: .2em;
}
.markdown p:not(:first-child) {
    margin-top: 0rem;
}
.markdown p {
    margin-bottom: 0rem;
}
.prose :where(ul):not(:where([class~=not-prose] *)) {
    margin-bottom: 0.25em;
}
.markdown h4 {
    font-weight: 600;
    margin-bottom: 0rem;
    margin-top: 0rem;
    color: #2db800;
}
.markdown :where(ol, ul) > li > :last-child {
    margin-bottom: 0;
    margin-top: 0;
}
.w-full ol > li > strong {
    color: #0cbc00 !important;
}
.w-full h3 > strong {
    color: #c40031 !important;
}
.w-full ul > li li,
.w-full ol > li li:not(li > ul:nth-child(3) > li:nth-child(1), ol ul > li:nth-child(1)) {
    color: #1b95ff;
}
.w-full ul > li:nth-child(1) strong:nth-child(3),
.w-full ul strong:nth-child(2) {
    color: #d8c8c8;
}
.w-full ul:nth-child(4) strong:nth-child(2) {
    background-color: #c39b9b;
    color: #000;
}
tr > .text-left > .flex {
    justify-self: center;
}
.py-2 {
    padding-bottom: 0.25rem;
    padding-top: .25rem;
    z-index: 9999;
    display: block;
}
tr .text-right {
    padding-left: 0;
    padding-right: 0;
}
.icon-sm {
    background-color: #900;
    Color: black;
}
.icon-sm:hover {
    background-color: #b200ff;
    Color: #000;
}
.sm\:p-6 > .mt-5 > .btn {
    font-size: 18px;
    z-index: 10010;
    border: 1px #24b500 solid;
}
.mt-5 > .btn:hover {
    background-color: #c3b4ca;
    Color: #000;
}
.group\/conversation-turn > .absolute > span {
    background-color: #de0000;
}
.btn-small {
    background-color: #007ccc;
    Color: black;
}
.btn-small:hover {
    background-color: #a6bdbf;
}
.pt-1 {
    padding-top: .25rem;
    background-color: #77007e;
    padding-right: 0.25rem;
}
[dir=ltr] .pr-5 {
    padding-right: 0;
}
.w-9 {
    background-color: #c37c00;
    Color: black;
    border-radius: 0px;
}
.w-9:hover {
    background-color: #00cb1b;
    Color: #000;
}
.text-token-text-primary > path {
    Color: #000;
}
.whitespace-pre-wrap {
    padding-left: 0px;
}
.bg-token-main-surface-tertiary {
    padding: 0;
    border: 1px #f00 solid;
    background-color: black;
}
.focus-visible\:ring-0 {
    Color: #a387f7;
}
.justify-end {
    justify-content: center;
    border: 1px #a700bd solid;
    opacity: 1;
    z-index: 9999;
    visibility: visible !important;
    justify-self: center;
    padding-right: 13px;
}
.btn-primary:is(.dark *) {
    background-color: #4ca8b4;
}
.justify-end > .btn-secondary:hover {
    background-color: #b92bc9;
}
.sm\:mb-3 {
    background-color: #4ca8b4 !important;
}
.justify-end > .btn-secondary {
    background-color: #c78801;
    color: black;
}
.h-9 {
    justify-content: center;
}
.flex-1 > span > .h-10 {
    background-color: #b92bc9;
}
[dir=ltr] .pl-3 {
    padding-left: unset;
}
[dir=ltr] .pr-3 {
    padding-right: unset;
}
.p-2 {
    padding-left: 10px;
    border: 1px #0098a3 solid;
    background-color: #000;
    text-align: left;
}
.p-2:hover {
    background-color: #af0000;
}
.from-60\% {
    background-color: #b62121;
}
.pr-1:not(.pr-1:nth-child(1)) {
    padding-right: 0rem;
}
.icon-2xl {
    background-color: #3e9e00;
}
.w-8 > svg {
    Color: #a49502;
}
.w-8 > svg:hover {
    Color: #000;
}
.gap-x-1 {
    background-color: #7d009e;
}
.h-8:hover {
    background-color: #007d9a;
    Color: #000;
}
.h-8 {
    border: 1px #000000 solid;
    background-color: #000;
}
.xl\:text-Mathjax {
    border: 2px #b40000 solid;
}
.max-h-Mathjax {
    background-color: black;
    border: 2px #a60000 solid;
}
.ml-6 {
    border-bottom: 1px #00c6ab solid;
}
li .text-sm > span {
    Color: #00a6cc;
    font-size: 18px;
}
li .pt-1 > span {
    Color: #bc0;
    font-size: 18px;
}
li .cursor-pointer {
    border: 1px #9f0000 solid;
}
.pb-3,
.py-3 {
    padding-top: 0rem;
    padding-bottom: 0.2rem;
}
.mb-3 {
    margin-bottom: 0rem;
}
.opacity-70 {
    background-color: #006981;
}
.markdown :where(ol, ul) > li > :first-child {
    Color: #00b30f;
}
.py-1 {
    border: 1px #00b493 solid;
}
.pe-2 {
    border: 1px #b95959 solid;
}
.rounded-t-\[5px\] {
    font-size: 18px;
    Color: red;
}
.icon-md {
    border: 1px #ff7b00 solid;
    Color: #f0f;
}
.isolate {
    border-left: 1px #9c0000 solid !important;
}
.lg\:px-4 {
    padding-left: 0rem;
    padding-right: 0rem;
}
.sm\:mt-5 {
    margin-top: 0rem;
    margin-bottom: 0rem;
    border: 1px #007991 solid;
}
#composer-background {
    padding-top: 0rem;
}
.z-Mathjax > .group {
    border: 1px #007991 solid;
}
* {
    scrollbar-color: #b200b7 transparent;
}
.dark :hover {
    scrollbar-color: #00b718 transparent;
}
.dark :not(.light).popover,
.dark.popover,
.popover .dark {
    z-index: 9999;
}
.group > .w-full {
    border: 1px #00999f solid;
}
.px-6 {
    padding-left: 0.25rem;
}
.py-Mathjax {
    padding-bottom: 10px;
    padding-top: 10px;
}
.px-3 > .mx-auto {
    border: 1px #00afa8 solid;
}
.z-Mathjax:hover {
    scrollbar-color: #00d81d transparent;
}
.markdown blockquote > p,
.markdown h2:first-child {
    Color: #d9c7c7;
}
.transition {
    background-color: #9d6300;
}
.align-middle {
    Color: #d9c7c7 !important;
}
.markdown h2 {
    font-weight: 600;
    margin-bottom: 0rem;
    margin-top: 0rem;
    Color: #d9c7c7 !important;
}
.prose :where(h1):not(:where([class~=not-prose] *)) {
    font-size: 18px;
    font-weight: 800;
    margin-bottom: 0.5em;
    margin-top: 0;
}
.px-6 {
    padding-right: unset !important;
}
.max-w-md {
    border: 1px #00c6ab solid;
    background-color: black;
}
li .pt-1 {
    padding-top: 0rem;
}
.bg-transparent {
    Color: #c40031 !important;
}
li > .cursor-pointer .text-sm {
    font-size: 18px;
}
.md\:pb-9 {
    padding-bottom: 0.25rem;
    padding-top: 0rem;
    border: 1px red solid;
}
.right-1\/2 {
    border: 1px red solid;
    border-radius: unset;
    background-color: #00a1a0;
}
.right-1\/2:hover {
    background-color: #8300a1;
}
.ps-3 {
    padding-left: 0;
}
.contain-inline-size {
    margin-top: 0;
    border-top: 1px #b00 solid !important;
    border-Bottom: 1px #b00 solid !important;
}
.markdown td,
.markdown th {
    text-align: center;
    border: 1px #ac8b8b solid;
    padding-left: 5px;
}
.markdown th,
.markdown h1 {
    color: #d8c8c8;
}
.\@\[64rem\]\:\[--thread-content-max-width\:48rem\] {
    --thread-content-max-width: 64rem;
    border: 1px #a00 solid;
}
.\@\[70rem\]\:\[--thread-content-margin\:--spacing\(12\)\] {
    --thread-content-margin: calc(var(--spacing)* 0);
}
.h-8 {
    border: 1px #000000 solid;
    background-color: #bf00cf;
    z-index: 9999;
    border-radius: unset;
}
.group-hover\/turn-messages\:delay-300:is(:where(.group\/turn-messages):hover *) {
    transition-delay: unset;
}
.duration-300 {
    --tw-duration: unset;
    transition-duration: unset;
}
.\[scrollbar-gutter\:stable\] {
    padding-top: unset;
}
.\@\[72rem\]\:\[--thread-content-margin\:--spacing\(16\)\] {
    --thread-content-margin: unset;
}
.\@\[37rem\]\:\[--thread-content-margin\:--spacing\(6\)\] {
    --thread-content-margin: unset;
}
.bg-primary-surface-primary {
    border-top: 1px #00989b solid;
}
.duration-300 > span {
    border: 1px #ba00c0 solid;
}
.\[scrollbar-gutter\:stable_both-edges\] {
    padding-top: 0;
}
.mt-1\.5 {
    margin-top: unset;
}
.break-all {
    Color: #d9c7c7 !important;
    font-size: 18px;
}
.transition-opacity {
    padding-left: unset;
}
.icon-xl-heavy {
    Color: #d9c7c7 !important;
}
.opacity-0 {
    opacity: 1 !important;
}
.group-hover\/turn-messages\:pointer-events-auto:is(:where(.group\/turn-messages):hover *) {
    pointer-events: unset;
}
.m-2 {
    margin: 0;
}
/*-----------------------------------------*/
/*chat history*/
.truncate {
    Font-size: 18px;
}
.mt-5 {
    margin-top: 0;
}
.mx-\[3px\] {
    margin-inline: 0px;
}
.__menu-label {
    --tw-font-weight: var(--font-weight-normal);
    color: #c6a3a3;
    display: block;
    font-size: 18px;
    font-weight: var(--font-weight-normal);
    margin: unset !important;
    padding: 0 !important;
}
.gap-6
{
    padding-right: 0px;
    padding-left: 5px;
    padding-top: 0;
    padding-bottom: 0px;
    border: 1px green solid;
    margin: 0;
}
.gap-6:hover {
    background-color: #a30000;
}
.__menu-item:not(:disabled):not([data-disabled])[data-active] {
    border: 3px #db0000 solid;
    margin: 0;
}
.__menu-item:not(:disabled):not([data-disabled])[data-active]:hover {
    background-color: green;
}
.gap-1\.5:nth-child(3) {
    padding: 0;
}
.__menu-item-trailing-btn > * {
    align-items: center;
    border-radius: 0;
}
.__menu-item:not(:disabled):not([data-disabled])[data-active] {
    background-color: unset;
}
.mt-2 {
    margin-top: 0;
}
.mt-2 > .group:nth-child(1) {
    padding: 0;
}
.gap-1\.5:hover {
    background-color: #a30000;
}
:is(.__menu-item[data-has-submenu], .__menu-item:has(.trailing))[data-fill] {
    border: 1px #b4a400 solid;
    margin: 0;
    padding: 0 0px 0 4px;
}
:is(.__menu-item[data-has-submenu], .__menu-item:has(.trailing))[data-fill]:hover {
    border: 3px #00ab3e solid;
    background-color: #b49b9b;
}
.gap-2\.5:hover {
    Color: black !important;
}
/*chat history*/
/*-----------------------------------------*/
.pt-1\.5 {
    padding-top: 0;
}
.line-clamp-3 {
    Color: #d13eff;
    font-size: 18px;
    Font-weight: 600;
}
.px-2\.5 {
    padding: 0;
}
.p-0 {
    padding-top: 18px;
}
.tabular-nums {
    Color: #e1c7c7;
}
/*main text input field*/
/*-----------------------------------------*/
.mx-5 {
    align-self: center;
    margin: 0;
}
#prompt-textarea > p {
    Color: #cd0101;
    font-size: 18px;
}
#prompt-textarea {
    margin: 0;
    padding: 0px;
}
.justify-content-end {
    border-top: 1px #00a4b9 solid;
}
.py-1\.5 {
    Color: #00bdca;
    background-color: black;
    text-align: center;
    border: 1px #a300a7 solid;
    place-self: center;
}
/*main text input field*/
/*-----------------------------------------*/
.pt-3 {
    padding: 0;
}
.thread-xl\:pt-header-height {
    padding-top: 0;
}
.thread-lg\:\[--thread-content-max-width\:48rem\] {
    --thread-content-max-width: 64rem;
    border: 1px #e10000 solid;
}
.md\:gap-8 {
    gap: 0;
}
:is(.light .dark, .dark) code.hljs,
:is(.light .dark, .dark) code[class*=language-],
:is(.light .dark, .dark) pre[class*=language-] {
    color: #e2d1d1;
}
.markdown-new-styling :is(.markdown hr) {
    margin-block: 0;
}
.duration-\[1\.5s\] {
    transition-duration: unset;
    justify-content: center;
}
.p-1 {
    padding: 0;
    border-top: 1px #bf9e9e solid;
}
p > em {
    Color: #00c016;
}
.markdown-new-styling :is(.markdown p+p) {
    margin-block: 0;
}
.pb-9\!
,.gap-4
{
    padding: 0px !important;
    padding: calc(var(--spacing)*0) !important;
}
.pe-2\.5\! {
    padding-inline-end: calc(var(--spacing)*0) !important;
}
.ps-4\! {
    padding-inline-start: calc(var(--spacing)*0) !important;
}
.py-4 {
    padding-block: calc(var(--spacing)*0) !important;
}
.-mb-9 {
    margin-bottom: unset !important;
}
#thread-bottom > div > div > div.pointer-events-auto.relative.z-1.flex.h-\[var\(--composer-container-height\,100\%\)\].max-w-full.flex-\[var\(--composer-container-flex\,1\)\].flex-col > div > div > div > div > div > aside
{
    padding: 0px !important;
    background-color: black !important;
}
.\@w-xl\/main\:pt-header-height {
    padding-top: 10px;
}
.\@w-lg\/main\:\[--thread-content-max-width\:48rem\] {
    --thread-content-max-width: 1093px;
    border: 1px #e10000 solid;
}
.composer-submit-btn {
    background-color: #d8cbcb;
    border: 2px #00e125 solid;
}
/*========================================================*/
`;
// State management
const state = {
enabled: true,
styleElement: null,
observer: null,
retryCount: 0,
lastThrottle: 0,
menuCommandId: null,
currentURL: location.href
};

// Utility functions
const utils = {
log(message) {
if (!CONFIG.DEBUG_MODE) return;
try {
const logger = typeof GM_log !== 'undefined' ? GM_log : console.log;
logger(`ChatGPT Styler: ${message}`);
} catch (e) {
console.log(`ChatGPT Styler: ${message}`);
}
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
this.log(`Error in safeCall: ${e}`);
return fallback;
}
},

getValue(key, defaultValue) {
return this.safeCall(() =>
typeof GM_getValue !== 'undefined' ? GM_getValue(key, defaultValue) : defaultValue
, defaultValue);
},

setValue(key, value) {
return this.safeCall(() => {
if (typeof GM_setValue !== 'undefined') {
GM_setValue(key, value);
return true;
}
return false;
}, false);
}
};

// Style management
const styleManager = {
apply() {
if (!state.enabled) return false;

this.remove();

// Method 1: Direct style injection (most reliable)
if (this.injectStyleElement()) return true;

// Method 2: GM_addStyle fallback
if (this.useGMAddStyle()) return true;

utils.log('Failed to apply styles with any method');
return false;
},

injectStyleElement() {
return utils.safeCall(() => {
if (!document.head) return false;

state.styleElement = document.createElement('style');
state.styleElement.id = CONFIG.STYLE_ID;
state.styleElement.type = 'text/css';
state.styleElement.textContent = USER_CSS;

// Make it hard to remove
state.styleElement.setAttribute('data-protected', 'true');

document.head.appendChild(state.styleElement);
utils.log('Styles applied via style element');
return true;
}, false);
},

useGMAddStyle() {
return utils.safeCall(() => {
if (typeof GM_addStyle === 'undefined') return false;
GM_addStyle(USER_CSS);
utils.log('Styles applied via GM_addStyle');
return true;
}, false);
},

remove() {
// Remove existing style elements
const existingStyle = document.getElementById(CONFIG.STYLE_ID);
if (existingStyle) {
existingStyle.remove();
}
state.styleElement = null;
utils.log('Styles removed');
},

isApplied() {
return !!document.getElementById(CONFIG.STYLE_ID);
},

forceReapply() {
if (state.enabled && !this.isApplied()) {
utils.log('Force reapplying styles');
this.apply();
}
}
};

// Observer management
const observerManager = {
setup() {
this.cleanup();
if (!state.enabled) return;

this.createDOMObserver();
utils.log('Observer started');
},

createDOMObserver() {
const throttledReapply = utils.throttle(() => {
styleManager.forceReapply();
}, CONFIG.OBSERVER_THROTTLE);

state.observer = new MutationObserver(mutations => {
let shouldReapply = false;

for (const mutation of mutations) {
// Check for removed style element
if (mutation.removedNodes.length > 0) {
for (const node of mutation.removedNodes) {
if (node.id === CONFIG.STYLE_ID) {
shouldReapply = true;
break;
}
}
}

// Check for added nodes that might affect styling
if (mutation.addedNodes.length > 0 && mutation.target === document.head) {
shouldReapply = true;
}
}

if (shouldReapply) {
throttledReapply();
}
});

state.observer.observe(document, {
childList: true,
subtree: true
});
},

cleanup() {
if (state.observer) {
state.observer.disconnect();
state.observer = null;
}
utils.log('Observer cleaned up');
}
};

// Menu management
const menuManager = {
setup() {
if (typeof GM_registerMenuCommand === 'undefined') return;

this.updateToggleCommand();
utils.log('Menu commands registered');
},

updateToggleCommand() {
utils.safeCall(() => {
// Remove existing command
if (state.menuCommandId && typeof GM_unregisterMenuCommand !== 'undefined') {
GM_unregisterMenuCommand(state.menuCommandId);
}

// Register new command
const commandText = state.enabled ? '🎨 Styles ON ✅' : '🎨 Styles OFF ❌';
state.menuCommandId = GM_registerMenuCommand(commandText, () => {
this.toggleStyles();
});
});
},

toggleStyles() {
state.enabled = !state.enabled;
utils.setValue('stylesEnabled', state.enabled);

if (state.enabled) {
styleManager.apply();
observerManager.setup();
} else {
styleManager.remove();
observerManager.cleanup();
}

this.updateToggleCommand();
utils.log(`Styles ${state.enabled ? 'enabled' : 'disabled'}`);
}
};

// SPA Navigation handling
const navigationManager = {
init() {
this.overrideHistoryMethods();
window.addEventListener('popstate', this.handleURLChange);
window.addEventListener('hashchange', this.handleURLChange);
},

overrideHistoryMethods() {
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function() {
originalPushState.apply(this, arguments);
navigationManager.handleURLChange();
};

history.replaceState = function() {
originalReplaceState.apply(this, arguments);
navigationManager.handleURLChange();
};
},

handleURLChange: utils.throttle(() => {
if (location.href !== state.currentURL) {
state.currentURL = location.href;
utils.log(`URL changed: ${state.currentURL}`);
if (state.enabled) {
styleManager.forceReapply();
}
}
}, 300)
};

// Main initialization
const app = {
init() {
utils.log('Initializing ChatGPT Styler Enhanced');

// Load saved state
state.enabled = utils.getValue('stylesEnabled', true);

// Apply styles with retry mechanism
this.applyWithRetry();

// Setup observer and menu
observerManager.setup();
menuManager.setup();

// Setup event listeners and SPA handling
this.setupEventListeners();
navigationManager.init();

utils.log(`Initialization complete. Styles: ${state.enabled ? 'enabled' : 'disabled'}`);
},

applyWithRetry() {
if (!state.enabled) return;

const attempt = () => {
if (styleManager.apply()) {
state.retryCount = 0;
return;
}

state.retryCount++;
if (state.retryCount < CONFIG.MAX_RETRIES) {
setTimeout(attempt, CONFIG.RETRY_DELAY);
} else {
utils.log('Max retries reached, giving up');
}
};

attempt();
},

setupEventListeners() {
// Handle visibility changes
document.addEventListener('visibilitychange', () => {
if (!document.hidden && state.enabled) {
setTimeout(() => styleManager.forceReapply(), 100);
}
});

// Handle focus events
window.addEventListener('focus', () => {
if (state.enabled) {
setTimeout(() => styleManager.forceReapply(), 100);
}
});

// Cleanup on unload
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
