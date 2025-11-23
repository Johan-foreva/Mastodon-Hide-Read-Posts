// ==UserScript==
// @name Mastodon Hide Read Posts (Logic Fixed) 5.9 (Grok)
// @namespace http://tampermonkey.net/
// @version 5.9
// @description Hide posts after reading, persistent storage, toggle button in drawer
// @match https://tilde.zone/*
// @grant none
// @run-at document-end
// ==/UserScript==
(function() {
    'use strict';
    // === CONFIG ===
    const HIDE_DELAY_MS = 1000;
    const STORAGE_KEY_READ = 'gm-read-posts';
    const STORAGE_KEY_ENABLED = 'gm-hide-enabled';
    const MAX_IDS = 1000;
    const HIDDEN_CLASS = 'gm-post-hidden';
    let hidingEnabled = localStorage.getItem(STORAGE_KEY_ENABLED) === 'true';
    let readSet = new Set();
    try { readSet = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY_READ) || '[]')); }
    catch { readSet = new Set(); }
    // === UTILS ===
    function saveReadSet() {
        while (readSet.size > MAX_IDS) {
            // FILO (LIFO): remove the last added
            const arr = [...readSet];
            if (arr.length > 0) {
                readSet.delete(arr.pop());
            }
        }
        localStorage.setItem(STORAGE_KEY_READ, JSON.stringify([...readSet]));
    }
    // === OBSERVER STATE ===
    const visibilityTimers = new Map(); // article -> timeoutId
    const readFlags = new WeakMap(); // article -> true
    // IntersectionObserver
    const observer = new IntersectionObserver(handleIntersect, { threshold: 0.01 });
    function handleIntersect(entries) {
        for (const entry of entries) {
            const article = entry.target;
            const id = article.getAttribute('data-id');
            if (!id) continue;
            if (entry.isIntersecting) {
                // Пост появился → запускаем таймер
                if (!readFlags.get(article) && !visibilityTimers.has(article)) {
                    const t = setTimeout(() => {
                        readFlags.set(article, true);
                        visibilityTimers.delete(article);
                        // Помечаем на удаление, но не скрываем сразу — ждём ухода из окна
                    }, HIDE_DELAY_MS);
                    visibilityTimers.set(article, t);
                }
            } else {
                // Пост ушёл с экрана → останавливаем таймер и скрываем, если помечен на удаление
                const timer = visibilityTimers.get(article);
                if (timer) { clearTimeout(timer); visibilityTimers.delete(article); }
                if (readFlags.get(article) && hidingEnabled) {
                    hideArticle(article, id);
                }
            }
        }
    }
    function hideArticle(article, id) {
        if (!hidingEnabled) return;
        if (!readSet.has(id)) { readSet.add(id); saveReadSet(); }
        article.classList.add(HIDDEN_CLASS);
        article.style.display = 'none';
    }
    function showAllArticles() {
        document.querySelectorAll('article.' + HIDDEN_CLASS).forEach(a => {
            a.classList.remove(HIDDEN_CLASS);
            a.style.removeProperty('display');
        });
    }
    // === PROCESS POSTS ===
    function processPosts() {
        document.querySelectorAll('article[data-id]').forEach(article => {
            observer.observe(article);
            const id = article.getAttribute('data-id');
            if (readSet.has(id) && hidingEnabled) {
                // При загрузке страницы: скрываем read посты сразу (восстанавливаем состояние)
                hideArticle(article, id);
            }
        });
    }
    // Optimized MutationObserver: only process added articles
    const feedObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Find all article[data-id] in this added subtree (including the node itself)
                    const articles = node.querySelectorAll ? node.querySelectorAll('article[data-id]') : [];
                    if (node.matches && node.matches('article[data-id]')) {
                        articles.push(node); // Include the node if it matches
                    }
                    [...new Set(articles)].forEach((article) => { // Dedupe if any
                        observer.observe(article);
                        const id = article.getAttribute('data-id');
                        if (readSet.has(id) && hidingEnabled) {
                            hideArticle(article, id);
                        }
                    });
                }
            });
        });
    });
    feedObserver.observe(document.body, { childList: true, subtree: true });
    // === STYLE ===
    const style = document.createElement('style');
    style.textContent = `.${HIDDEN_CLASS} { display: none !important; }`;
    document.head.appendChild(style);
    // === DRAWER BUTTON ===
    function addHideReadButton() {
        const drawerTabs = document.querySelectorAll('.drawer__tab');
//        console.log('[GM-Hide] Found', drawerTabs.length, 'drawer tabs');
        const signOutBtn = Array.from(drawerTabs).find(a => a.getAttribute('href') === '/auth/sign_out');
//        console.log('[GM-Hide] Sign out btn:', !!signOutBtn);
        if (!signOutBtn || document.querySelector('#gm-hide-btn')) {
            if (!signOutBtn) console.log('[GM-Hide] No signOutBtn found');
            if (document.querySelector('#gm-hide-btn')) console.log('[GM-Hide] Button already exists');
            return;
        }
//        console.log('[GM-Hide] Creating btn');
        const btn = document.createElement('a');
        btn.href = '#';
        btn.id = 'gm-hide-btn';
        btn.className = 'drawer__tab';
        btn.title = 'Toggle hide-read mode';
        btn.setAttribute('aria-label', 'Toggle hide-read mode');
//        console.log('[GM-Hide] Btn created');

        function renderIcon() {
            btn.innerHTML = hidingEnabled
                ? `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" class="icon"><path d="M7.6,21.7c0.7,0.1,1.5,0.2,2.3,0.3c0,0,0.1,0,0.1,0c0.5,0,1-0.4,1-0.9c0-0.6-0.4-1-0.9-1.1c-0.7-0.1-1.4-0.1-2.1-0.2
			c-0.6-0.1-1.2-0.6-1.3-1.4C6.2,16.2,6,14.1,6,12c0-0.4,0-0.9,0-1.3c0.2,0,0.5,0,0.7,0c1,0,1.9-0.1,2.9-0.4C11,10,12,9.1,12.5,7.8
			c0.2-0.7,0.4-1.5,0.4-2.2c0-0.4,0-0.7-0.1-1.2L12.7,4c1.1,0,2.3,0.1,3.4,0.3c0.6,0.1,1.2,0.6,1.3,1.4C17.8,7.8,18,9.9,18,12
			c0,0.6,0,1.3-0.1,1.9c0,0.6,0.4,1,0.9,1.1c0.5,0,1-0.4,1.1-0.9c0-0.7,0.1-1.3,0.1-2c0-2.2-0.2-4.5-0.7-6.7c-0.3-1.5-1.5-2.7-3-3
			C14.8,2.1,13.1,2,11.5,2l-0.1,0c0,0,0,0-0.1,0c0,0-0.1,0-0.1,0l-0.1,0C8,3.5,5.5,6,4.2,9.2L4.1,9.4l0,0.2C4,10.4,4,11.2,4,12
			c0,2.2,0.2,4.5,0.7,6.7C5,20.3,6.2,21.4,7.6,21.7z M10.7,4.5l0,0.1c0,0.3,0.1,0.6,0.1,0.9c0,0.6-0.1,1.1-0.3,1.6
			c-0.2,0.6-0.7,1.1-1.4,1.3C8.3,8.6,7.5,8.7,6.6,8.7C7.6,7,9,5.5,10.7,4.5z"/>
		<path d="M22.2,18.2c-0.5-0.2-1.1,0-1.3,0.6c-0.7,1.8-2.6,2.4-4.1,2.4s-3.4-0.6-4.1-2.4c-0.2-0.5-0.8-0.8-1.3-0.6
			c-0.5,0.2-0.8,0.8-0.6,1.3c0.9,2.2,3.2,3.6,5.9,3.6s5-1.4,5.9-3.6C23,18.9,22.7,18.4,22.2,18.2z"/><svg>`
                : `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" class="icon"><path d="M7.6,21.7c0.7,0.1,1.5,0.2,2.3,0.3c0,0,0.1,0,0.1,0c0.5,0,1-0.4,1-0.9c0-0.6-0.4-1-0.9-1.1c-0.7-0.1-1.4-0.1-2.1-0.2
			c-0.6-0.1-1.2-0.6-1.3-1.4C6.2,16.2,6,14.1,6,12c0-0.4,0-0.9,0-1.3c0.2,0,0.5,0,0.7,0c1,0,1.9-0.1,2.9-0.4C11,10,12,9.1,12.5,7.8
			c0.2-0.7,0.4-1.5,0.4-2.2c0-0.4,0-0.7-0.1-1.2L12.7,4c1.1,0,2.3,0.1,3.4,0.3c0.6,0.1,1.2,0.6,1.3,1.4C17.8,7.8,18,9.9,18,12
			c0,0.6,0,1.3-0.1,1.9c0,0.6,0.4,1,0.9,1.1c0.5,0,1-0.4,1.1-0.9c0-0.7,0.1-1.3,0.1-2c0-2.2-0.2-4.5-0.7-6.7c-0.3-1.5-1.5-2.7-3-3
			C14.8,2.1,13.1,2,11.5,2l-0.1,0c0,0,0,0-0.1,0c0,0-0.1,0-0.1,0l-0.1,0C8,3.5,5.5,6,4.2,9.2L4.1,9.4l0,0.2C4,10.4,4,11.2,4,12
			c0,2.2,0.2,4.5,0.7,6.7C5,20.3,6.2,21.4,7.6,21.7z M10.7,4.5l0,0.1c0,0.3,0.1,0.6,0.1,0.9c0,0.6-0.1,1.1-0.3,1.6
			c-0.2,0.6-0.7,1.1-1.4,1.3C8.3,8.6,7.5,8.7,6.6,8.7C7.6,7,9,5.5,10.7,4.5z"/>
		<ellipse cx="16.8" cy="19.1" rx="1.7" ry="1.7"/>
		<path d="M22.8,19.1c0-0.1,0-0.2,0-0.3c0,0,0-0.1,0-0.1c0,0,0,0,0,0c0,0,0,0,0,0c-0.9-2.2-3.2-3.6-5.9-3.6c-2.7,0-5,1.4-5.9,3.6
			c0,0,0,0,0,0c0,0,0,0,0,0c0,0,0,0.1,0,0.1c0,0.1,0,0.2,0,0.3c0,0.1,0,0.2,0,0.3c0,0,0,0.1,0,0.1c0,0,0,0,0,0c0,0,0,0,0,0
			c0.9,2.2,3.2,3.6,5.9,3.6c2.7,0,5-1.4,5.9-3.6c0,0,0,0,0,0c0,0,0,0,0,0c0,0,0-0.1,0-0.1C22.8,19.3,22.8,19.2,22.8,19.1z
			 M16.8,21.1c-1.3,0-3.1-0.5-3.9-2c0.8-1.5,2.5-2,3.9-2c1.3,0,3.1,0.5,3.9,2C19.9,20.5,18.2,21.1,16.8,21.1z"/></svg>`;
        }
        renderIcon();
        try {
            btn.addEventListener('click', e => {
                e.preventDefault();
                hidingEnabled = !hidingEnabled;
                localStorage.setItem(STORAGE_KEY_ENABLED, hidingEnabled);
                renderIcon();
                if (!hidingEnabled) {
                    showAllArticles();
                } else {
                    processPosts();
                }
            });
//            console.log('[GM-Hide] Event listener added');
            signOutBtn.insertAdjacentElement('afterend', btn);
//            console.log('[GM-Hide] Button inserted into DOM');
        } catch (e) {
//            console.error('[GM-Hide] Error adding listener or inserting btn:', e.message);
        }
    }
    // === DRAWER OBSERVER ===
    const drawerObserver = new MutationObserver((mutations) => {
        let tabsAdded = false;
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && node.querySelectorAll('.drawer__tab').length > 0) {
                    tabsAdded = true;
                }
            });
        });
        if (tabsAdded) {
//            console.log('[GM-Hide] Drawer tabs detected - adding button');
            addHideReadButton();
        }
    });
    drawerObserver.observe(document.body, { childList: true, subtree: true });
    // Immediate and fallback calls for web version where drawer is early
    setTimeout(addHideReadButton, 500);
    setTimeout(addHideReadButton, 2000);
    setTimeout(addHideReadButton, 5000);
    // Initial process after short delay for SPA
    setTimeout(processPosts, 1000);
})();
