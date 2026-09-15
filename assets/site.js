/*! dshjob.com 通用交互脚本（经典 defer 脚本，无依赖、无 fetch/XHR）
 * 所有 DOM 查询判空安全退出；任一功能初始化失败不影响其余功能。 */
(function () {
  'use strict';

  // 最先标记 JS 可用：CSS 据此显示复制按钮等增强控件
  document.documentElement.classList.add('js');

  // 共享 aria-live 播报：区域不存在则创建；CSS 缺 .visually-hidden 时内联 sr-only 兜底
  function announce(msg) {
    try {
      var live = document.getElementById('a11y-live');
      if (!live) {
        live = document.createElement('div');
        live.id = 'a11y-live';
        live.className = 'visually-hidden';
        live.setAttribute('aria-live', 'polite');
        document.body.appendChild(live);
        if (window.getComputedStyle(live).position === 'static') {
          live.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;' +
            'border:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;';
        }
      }
      live.textContent = ''; // 先清空再延迟写入，重复播报也能被读屏感知
      window.setTimeout(function () { live.textContent = msg; }, 30);
    } catch (e) { /* 播报失败不影响主功能 */ }
  }

  // 移动菜单：按钮初始 hidden，由本脚本移除并接管；无 JS 时导航保持普通链接
  function initMenu() {
    var btn = document.getElementById('menu-toggle');
    var nav = document.getElementById('site-nav');
    var header = document.querySelector('header.site-header');
    if (!btn || !nav || !header) return;
    var focusables = [btn].concat(Array.prototype.slice.call(nav.querySelectorAll('a')));

    function isOpen() { return header.classList.contains('nav-open'); }
    function setOpen(open) {
      header.classList.toggle('nav-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    btn.hidden = false;
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'site-nav');
    btn.addEventListener('click', function () { setOpen(!isOpen()); });
    // 点击导航链接后收起菜单；锚点跳转交还浏览器默认行为
    nav.addEventListener('click', function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest('a')) setOpen(false);
    });
    // Escape 关闭并把焦点还给按钮；菜单开启时 Tab 在按钮与导航链接间循环
    document.addEventListener('keydown', function (ev) {
      if (!isOpen()) return;
      if (ev.key === 'Escape') { setOpen(false); btn.focus(); }
      if (ev.key !== 'Tab') return;
      var idx = focusables.indexOf(document.activeElement);
      if (ev.shiftKey && idx <= 0) { ev.preventDefault(); focusables[focusables.length - 1].focus(); }
      if (!ev.shiftKey && (idx === -1 || idx === focusables.length - 1)) { ev.preventDefault(); focusables[0].focus(); }
    });
  }

  // 演示切换：无 JS 时三面板全部可见；JS 增强为 tablist（方向键 / Home / End / Enter / Space）
  function initDemoTabs() {
    Array.prototype.forEach.call(document.querySelectorAll('.demo-tabs'), function (box) {
      var tabList = box.querySelector('.tab-list');
      if (!tabList) return;
      var tabs = Array.prototype.slice.call(tabList.querySelectorAll('.demo-tab'));
      var panels = tabs.map(function (tab) { return document.getElementById(tab.getAttribute('data-target')); });
      if (!tabs.length || panels.indexOf(null) !== -1) return;
      tabList.setAttribute('role', 'tablist');
      tabs.forEach(function (tab, i) {
        if (!tab.id) tab.id = panels[i].id + '-tab';
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', panels[i].id);
        tab.addEventListener('click', function () { select(i, false); });
      });
      panels.forEach(function (panel, i) {
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tabs[i].id);
        panel.setAttribute('tabindex', '0'); // 面板可直接进入焦点，便于键盘阅读
      });
      function select(index, focus) {
        tabs.forEach(function (tab, i) {
          var on = i === index;
          tab.setAttribute('aria-selected', on ? 'true' : 'false');
          tab.tabIndex = on ? 0 : -1; // 仅当前 tab 参与 Tab 焦点序列
          panels[i].hidden = !on;     // 非活动面板隐藏
        });
        if (focus) tabs[index].focus();
      }
      // Enter / Space 由按钮原生 click 触发切换；这里只处理焦点移动键
      tabList.addEventListener('keydown', function (ev) {
        var n = tabs.length, i = tabs.indexOf(document.activeElement), next = null;
        if (i === -1) return;
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = (i + 1) % n;
        else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = (i - 1 + n) % n;
        else if (ev.key === 'Home') next = 0;
        else if (ev.key === 'End') next = n - 1;
        if (next === null) return;
        ev.preventDefault();
        select(next, true);
      });
      var initial = 0;
      tabs.forEach(function (tab, i) { if (tab.hasAttribute('data-default')) initial = i; });
      select(initial, false); // 默认激活带 data-default 的视图（原型 v2 默认「查看岗位」）
    });
  }

  // 复制：成功时按钮文字临时变“已复制”并播报；失败显示手动复制提示，不误报
  function initCopy() {
    Array.prototype.forEach.call(document.querySelectorAll('.copy-button[data-copy]'), function (btn) {
      var label = btn.textContent; // 记录原始文字用于还原
      btn.addEventListener('click', function () {
        var fail = function () {
          var hint = btn.nextElementSibling;
          if (!hint || !hint.classList.contains('copy-hint')) {
            hint = (btn.parentNode || document).querySelector('.copy-hint');
          }
          if (hint) hint.classList.add('show');
          announce('复制未成功，请选中文字手动复制');
        };
        // file:// 非安全上下文或旧浏览器没有剪贴板 API：直接走手动出口
        if (!(navigator.clipboard && navigator.clipboard.writeText)) { fail(); return; }
        navigator.clipboard.writeText(btn.getAttribute('data-copy') || '').then(function () {
          btn.textContent = '已复制';
          announce('已复制');
          window.clearTimeout(btn._copyTimer); // 连续点击时重置计时
          btn._copyTimer = window.setTimeout(function () { btn.textContent = label; }, 2000);
        }, fail);
      });
    });
  }

  // 二维码兜底：图片加载失败时隐藏原图并显示文字联系方法
  function initQrFallback() {
    Array.prototype.forEach.call(document.querySelectorAll('img.qr-img'), function (img) {
      var scope = img.parentNode || document;
      var fallback = scope.querySelector('.qr-fallback') || document.querySelector('.qr-fallback');
      function degrade() {
        img.hidden = true;
        if (fallback) fallback.classList.add('show');
      }
      img.addEventListener('error', degrade);
      // 脚本执行前图片已加载失败（complete 且无尺寸）时直接降级
      if (img.complete && img.naturalWidth === 0) degrade();
    });
  }

  // 各功能独立初始化：任一段抛错都被捕获，不影响其余功能
  function boot() {
    [initMenu, initDemoTabs, initCopy, initQrFallback].forEach(function (init) {
      try { init(); } catch (e) { /* 静默降级 */ }
    });
  }

  // defer 下 DOM 已就绪；兼容无 defer 或动态注入的情况
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
