/* FujiTrace Chatbot Widget - https://fujitrace.jp */
(function () {
  "use strict";

  var scriptEl =
    document.querySelector("script[data-key][src*='widget.js']") ||
    document.querySelector("script[data-key]");

  if (!scriptEl) {
    console.warn("[FujiTrace] widget.js: data-key attribute not found.");
    return;
  }

  var publishKey = scriptEl.getAttribute("data-key");
  if (!publishKey) {
    console.warn("[FujiTrace] widget.js: data-key is empty.");
    return;
  }

  var dataTheme = scriptEl.getAttribute("data-theme") || "auto";
  var dataPosition = scriptEl.getAttribute("data-position") || "bottom-right";

  // Derive API base from script src origin
  var apiBase = "";
  try {
    var srcAttr = scriptEl.getAttribute("src") || "";
    if (srcAttr && /^https?:\/\//.test(srcAttr)) {
      var u = new URL(srcAttr);
      apiBase = u.origin;
    }
  } catch (_) {
    /* ignore */
  }
  if (!apiBase) {
    apiBase = window.location.origin;
  }

  var config = null; // widget config from API
  var configError = false;
  var isOpen = false;
  var messages = []; // { role: "user"|"bot", content: string }
  var isTyping = false;
  var unreadCount = 0;
  var sessionId = null;

  // Visitor ID
  var VISITOR_KEY = "fujitrace_visitor_id";
  var visitorId = "";
  try {
    visitorId = localStorage.getItem(VISITOR_KEY) || "";
  } catch (_) {
    /* localStorage unavailable */
  }
  if (!visitorId) {
    visitorId = "v_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    try {
      localStorage.setItem(VISITOR_KEY, visitorId);
    } catch (_) {
      /* ignore */
    }
  }

  function resolveTheme() {
    if (dataTheme === "light" || dataTheme === "dark") return dataTheme;
    // auto
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  var SIZES = {
    compact: { w: 320, h: 440 },
    standard: { w: 380, h: 520 },
    large: { w: 440, h: 600 },
  };

  function getSize() {
    var key = (config && config.widget_window_size) || "standard";
    return SIZES[key] || SIZES.standard;
  }

  function getBorderRadius() {
    var r = (config && config.widget_border_radius) || "rounded";
    if (r === "sharp") return "4px";
    if (r === "pill") return "24px";
    return "12px";
  }

  function getColor() {
    return (config && config.widget_color) || "#2563eb";
  }

  function getSecondaryColor() {
    return (config && config.widget_secondary_color) || darken(getColor(), 20);
  }

  function darken(hex, pct) {
    var num = parseInt(hex.replace("#", ""), 16);
    var r = Math.max(0, (num >> 16) - pct);
    var g = Math.max(0, ((num >> 8) & 0x00ff) - pct);
    var b = Math.max(0, (num & 0x0000ff) - pct);
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  var fontInjected = false;

  function ensureFont() {
    if (fontInjected) return;
    var f = (config && config.widget_font) || "system";
    if (f === "noto-sans-jp") {
        var existing = document.querySelector(
        'link[href*="fonts.googleapis.com"][href*="Noto+Sans+JP"]'
      );
      if (!existing) {
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href =
          "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap";
        document.head.appendChild(link);
      }
    }
    fontInjected = true;
  }

  function getFontFamily() {
    var f = (config && config.widget_font) || "system";
    if (f === "noto-sans-jp") {
      return '"Noto Sans JP", sans-serif';
    }
    if (f === "hiragino") {
      return '"Hiragino Kaku Gothic ProN", "Hiragino Sans", sans-serif';
    }
    return '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';
  }

  function injectStyles() {
    var style = document.createElement("style");
    style.setAttribute("data-fujitrace-widget", "");
    style.textContent = [
      ".fjt-widget-root *,.fjt-widget-root *::before,.fjt-widget-root *::after{box-sizing:border-box!important;margin:0!important;padding:0!important;border:0!important;outline:none!important;}",
      ".fjt-widget-bubble{position:fixed!important;width:56px!important;height:56px!important;border-radius:50%!important;cursor:pointer!important;z-index:99999!important;display:flex!important;align-items:center!important;justify-content:center!important;transition:transform .2s ease,box-shadow .2s ease!important;box-shadow:0 4px 12px rgba(0,0,0,.25)!important;}",
      ".fjt-widget-bubble:hover{transform:scale(1.08)!important;box-shadow:0 6px 20px rgba(0,0,0,.3)!important;}",
      ".fjt-widget-bubble svg{width:28px!important;height:28px!important;fill:none!important;stroke:#fff!important;stroke-width:2!important;stroke-linecap:round!important;stroke-linejoin:round!important;}",
      ".fjt-widget-badge{position:absolute!important;top:-4px!important;right:-4px!important;min-width:20px!important;height:20px!important;border-radius:10px!important;background:#ef4444!important;color:#fff!important;font-size:12px!important;font-weight:700!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0 5px!important;line-height:1!important;}",
      ".fjt-widget-window{position:fixed!important;z-index:99999!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;box-shadow:0 8px 30px rgba(0,0,0,.2)!important;transition:opacity .2s ease,transform .2s ease!important;}",
      ".fjt-widget-window.fjt-widget-hidden{opacity:0!important;pointer-events:none!important;transform:translateY(10px)!important;}",
      ".fjt-widget-header{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:14px 16px!important;color:#fff!important;font-weight:700!important;font-size:15px!important;flex-shrink:0!important;}",
      ".fjt-widget-header-title{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;flex:1!important;}",
      ".fjt-widget-close{width:28px!important;height:28px!important;border-radius:50%!important;background:rgba(255,255,255,.2)!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important;margin-left:8px!important;transition:background .15s!important;}",
      ".fjt-widget-close:hover{background:rgba(255,255,255,.35)!important;}",
      ".fjt-widget-close svg{width:16px!important;height:16px!important;stroke:#fff!important;stroke-width:2!important;fill:none!important;stroke-linecap:round!important;}",
      ".fjt-widget-messages{flex:1!important;overflow-y:auto!important;padding:16px!important;display:flex!important;flex-direction:column!important;gap:10px!important;}",
      ".fjt-widget-msg{max-width:80%!important;padding:10px 14px!important;font-size:14px!important;line-height:1.55!important;word-wrap:break-word!important;white-space:pre-wrap!important;}",
      ".fjt-widget-msg-bot{align-self:flex-start!important;border-radius:4px 12px 12px 12px!important;}",
      ".fjt-widget-msg-user{align-self:flex-end!important;color:#fff!important;border-radius:12px 4px 12px 12px!important;}",
      ".fjt-widget-typing{align-self:flex-start!important;padding:10px 18px!important;border-radius:12px!important;display:flex!important;gap:4px!important;align-items:center!important;}",
      ".fjt-widget-typing-dot{width:7px!important;height:7px!important;border-radius:50%!important;animation:fjt-bounce .6s infinite alternate!important;}",
      ".fjt-widget-typing-dot:nth-child(2){animation-delay:.2s!important;}",
      ".fjt-widget-typing-dot:nth-child(3){animation-delay:.4s!important;}",
      "@keyframes fjt-bounce{0%{opacity:.3;transform:translateY(0);}100%{opacity:1;transform:translateY(-4px);}}",
      ".fjt-widget-input-area{display:flex!important;align-items:center!important;padding:10px 12px!important;gap:8px!important;flex-shrink:0!important;border-top:1px solid!important;}",
      ".fjt-widget-input{flex:1!important;padding:9px 12px!important;border-radius:8px!important;font-size:14px!important;resize:none!important;line-height:1.4!important;border:1px solid!important;background:transparent!important;}",
      ".fjt-widget-input:focus{border-color:currentColor!important;}",
      ".fjt-widget-send{width:36px!important;height:36px!important;border-radius:50%!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important;transition:opacity .15s!important;}",
      ".fjt-widget-send:disabled{opacity:.5!important;cursor:default!important;}",
      ".fjt-widget-send svg{width:18px!important;height:18px!important;fill:none!important;stroke:#fff!important;stroke-width:2!important;stroke-linecap:round!important;stroke-linejoin:round!important;}",
      ".fjt-widget-error{padding:16px!important;text-align:center!important;font-size:14px!important;opacity:.7!important;}",
      "@media(max-width:480px){.fjt-widget-window{width:calc(100vw - 16px)!important;height:70vh!important;left:8px!important;right:8px!important;bottom:72px!important;}}",
    ].join("\n");
    document.head.appendChild(style);
  }

  var ICON_CHAT =
    '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

  var ICON_CLOSE =
    '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  var ICON_SEND =
    '<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  var root, bubble, badge, chatWindow, headerEl, messagesEl, inputEl, sendBtn;

  function buildDOM() {
    root = document.createElement("div");
    root.className = "fjt-widget-root";

    // Bubble
    bubble = document.createElement("button");
    bubble.className = "fjt-widget-bubble";
    bubble.setAttribute("aria-label", "\u30C1\u30E3\u30C3\u30C8\u3092\u958B\u304F");
    bubble.innerHTML = ICON_CHAT;

    badge = document.createElement("span");
    badge.className = "fjt-widget-badge";
    badge.style.cssText = "display:none!important;";
    bubble.appendChild(badge);

    // Chat window
    chatWindow = document.createElement("div");
    chatWindow.className = "fjt-widget-window fjt-widget-hidden";
    chatWindow.setAttribute("role", "dialog");
    chatWindow.setAttribute("aria-label", "\u30C1\u30E3\u30C3\u30C8");

    // Header
    headerEl = document.createElement("div");
    headerEl.className = "fjt-widget-header";
    var headerTitle = document.createElement("span");
    headerTitle.className = "fjt-widget-header-title";
    headerTitle.textContent = "\u30C1\u30E3\u30C3\u30C8\u30B5\u30DD\u30FC\u30C8";
    headerEl.appendChild(headerTitle);

    var closeBtn = document.createElement("button");
    closeBtn.className = "fjt-widget-close";
    closeBtn.setAttribute("aria-label", "\u30C1\u30E3\u30C3\u30C8\u3092\u9589\u3058\u308B");
    closeBtn.innerHTML = ICON_CLOSE;
    closeBtn.addEventListener("click", toggleChat);
    headerEl.appendChild(closeBtn);
    chatWindow.appendChild(headerEl);

    // Messages
    messagesEl = document.createElement("div");
    messagesEl.className = "fjt-widget-messages";
    chatWindow.appendChild(messagesEl);

    // Input area
    var inputArea = document.createElement("div");
    inputArea.className = "fjt-widget-input-area";

    inputEl = document.createElement("input");
    inputEl.className = "fjt-widget-input";
    inputEl.type = "text";
    inputEl.setAttribute("aria-label", "\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u5165\u529B");
    inputEl.setAttribute("placeholder", "\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u5165\u529B...");
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    inputArea.appendChild(inputEl);

    sendBtn = document.createElement("button");
    sendBtn.className = "fjt-widget-send";
    sendBtn.setAttribute("aria-label", "\u9001\u4FE1");
    sendBtn.innerHTML = ICON_SEND;
    sendBtn.addEventListener("click", sendMessage);
    inputArea.appendChild(sendBtn);

    chatWindow.appendChild(inputArea);

    // Bubble click
    bubble.addEventListener("click", toggleChat);

    root.appendChild(chatWindow);
    root.appendChild(bubble);
    document.body.appendChild(root);
  }

  function applyStyles() {
    var theme = resolveTheme();
    var color = getColor();
    var secondaryColor = getSecondaryColor();
    var size = getSize();
    var br = getBorderRadius();
    var pos = (config && config.widget_position) || dataPosition;
    var isLeft = pos === "bottom-left";
    var font = getFontFamily();

    // Bubble position
    bubble.style.cssText +=
      ";background:" + color + "!important;" +
      (isLeft ? "left:20px!important;right:auto!important;" : "right:20px!important;left:auto!important;") +
      "bottom:20px!important;";

    // Window positioning (desktop)
    var isMobile = window.innerWidth <= 480;
    var windowStyles =
      "font-family:" + font + "!important;" +
      "border-radius:" + br + "!important;";

    if (!isMobile) {
      windowStyles +=
        "width:" + size.w + "px!important;" +
        "height:" + size.h + "px!important;" +
        (isLeft ? "left:20px!important;right:auto!important;" : "right:20px!important;left:auto!important;") +
        "bottom:86px!important;";
    }

    // Theme colors
    var bgWindow, textColor, inputBg, inputBorder, botMsgBg, botMsgColor, typingDotColor, inputAreaBg, borderTopColor;
    if (theme === "dark") {
      bgWindow = "#1a1a2e";
      textColor = "#e2e8f0";
      inputBg = "#2a2a40";
      inputBorder = "#3a3a55";
      botMsgBg = "#2a2a40";
      botMsgColor = "#e2e8f0";
      typingDotColor = "#888";
      inputAreaBg = "#1a1a2e";
      borderTopColor = "#2a2a40";
    } else {
      bgWindow = "#ffffff";
      textColor = "#1a1a2e";
      inputBg = "#f8f9fa";
      inputBorder = "#dde1e6";
      botMsgBg = "#f1f3f5";
      botMsgColor = "#1a1a2e";
      typingDotColor = "#aaa";
      inputAreaBg = "#ffffff";
      borderTopColor = "#e5e7eb";
    }

    windowStyles += "background:" + bgWindow + "!important;color:" + textColor + "!important;";
    chatWindow.style.cssText = windowStyles;

    // Header
    headerEl.style.cssText += "background:" + color + "!important;";

    // Update header title from config
    var titleEl = headerEl.querySelector(".fjt-widget-header-title");
    if (titleEl && config) {
      titleEl.textContent = config.widget_header_text || config.name || "\u30C1\u30E3\u30C3\u30C8\u30B5\u30DD\u30FC\u30C8";
    }

    // Messages area
    messagesEl.style.cssText += "background:" + bgWindow + "!important;";

    // Input area
    var inputArea = chatWindow.querySelector(".fjt-widget-input-area");
    if (inputArea) {
      inputArea.style.cssText +=
        "background:" + inputAreaBg + "!important;" +
        "border-top-color:" + borderTopColor + "!important;";
    }

    // Input
    inputEl.style.cssText +=
      "background:" + inputBg + "!important;" +
      "color:" + textColor + "!important;" +
      "border-color:" + inputBorder + "!important;" +
      "font-family:" + font + "!important;";

    // Send button
    sendBtn.style.cssText += "background:" + color + "!important;";

    // Store theme variables for message rendering
    root._fjtTheme = {
      color: color,
      secondaryColor: secondaryColor,
      botMsgBg: botMsgBg,
      botMsgColor: botMsgColor,
      typingDotColor: typingDotColor,
      font: font,
    };
  }

  function renderMessage(msg) {
    var el = document.createElement("div");
    el.className = "fjt-widget-msg " + (msg.role === "user" ? "fjt-widget-msg-user" : "fjt-widget-msg-bot");
    el.textContent = msg.content;
    var t = root._fjtTheme || {};
    if (msg.role === "user") {
      el.style.cssText = "background:" + (t.color || "#2563eb") + "!important;";
    } else {
      el.style.cssText =
        "background:" + (t.botMsgBg || "#f1f3f5") + "!important;" +
        "color:" + (t.botMsgColor || "#1a1a2e") + "!important;";
    }
    return el;
  }

  function renderAllMessages() {
    while (messagesEl.firstChild) {
      messagesEl.removeChild(messagesEl.firstChild);
    }
    for (var i = 0; i < messages.length; i++) {
      messagesEl.appendChild(renderMessage(messages[i]));
    }
    if (isTyping) {
      messagesEl.appendChild(createTypingIndicator());
    }
    scrollToBottom();
  }

  function appendMessage(msg) {
    messages.push(msg);
    messagesEl.appendChild(renderMessage(msg));
    scrollToBottom();
  }

  function createTypingIndicator() {
    var el = document.createElement("div");
    el.className = "fjt-widget-typing";
    var t = root._fjtTheme || {};
    el.style.cssText = "background:" + (t.botMsgBg || "#f1f3f5") + "!important;";
    for (var i = 0; i < 3; i++) {
      var dot = document.createElement("span");
      dot.className = "fjt-widget-typing-dot";
      dot.style.cssText = "background:" + (t.typingDotColor || "#aaa") + "!important;";
      el.appendChild(dot);
    }
    return el;
  }

  function showTyping() {
    isTyping = true;
    messagesEl.appendChild(createTypingIndicator());
    scrollToBottom();
  }

  function hideTyping() {
    isTyping = false;
    var indicators = messagesEl.querySelectorAll(".fjt-widget-typing");
    for (var i = 0; i < indicators.length; i++) {
      indicators[i].parentNode.removeChild(indicators[i]);
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(function () {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      chatWindow.classList.remove("fjt-widget-hidden");
      unreadCount = 0;
      badge.style.cssText = "display:none!important;";
      bubble.setAttribute("aria-label", "\u30C1\u30E3\u30C3\u30C8\u3092\u9589\u3058\u308B");

      if (configError) {
        showErrorState();
      }

      // Focus input
      setTimeout(function () {
        inputEl.focus();
      }, 100);

      // Focus trap
      chatWindow.addEventListener("keydown", trapFocus);
    } else {
      chatWindow.classList.add("fjt-widget-hidden");
      bubble.setAttribute("aria-label", "\u30C1\u30E3\u30C3\u30C8\u3092\u958B\u304F");
      chatWindow.removeEventListener("keydown", trapFocus);
      bubble.focus();
    }
  }

  function trapFocus(e) {
    if (e.key !== "Tab") return;
    var focusable = chatWindow.querySelectorAll(
      'button, input, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function showErrorState() {
    if (messagesEl.querySelector(".fjt-widget-error")) return;
    var errEl = document.createElement("div");
    errEl.className = "fjt-widget-error";
    errEl.textContent = "\u30C1\u30E3\u30C3\u30C8\u30B5\u30DD\u30FC\u30C8\u306F\u73FE\u5728\u5229\u7528\u3067\u304D\u307E\u305B\u3093";
    messagesEl.appendChild(errEl);
    // Disable input
    inputEl.disabled = true;
    sendBtn.disabled = true;
  }

  function incrementUnread() {
    if (isOpen) return;
    unreadCount++;
    badge.textContent = String(unreadCount > 99 ? "99+" : unreadCount);
    badge.style.cssText = "display:flex!important;";
  }

  function fetchConfig() {
    var url = apiBase + "/api/widget/" + encodeURIComponent(publishKey) + "/config";
    return fetchWithTimeout(url, { method: "GET" }, 15000)
      .then(function (res) {
        if (!res.ok) throw new Error("Config response " + res.status);
        return res.json();
      })
      .then(function (data) {
        config = data;
        configError = false;
      })
      .catch(function (err) {
        console.warn("[FujiTrace] Failed to load widget config:", err.message || err);
        configError = true;
      });
  }

  function sendChatMessage(text) {
    var url = apiBase + "/api/widget/" + encodeURIComponent(publishKey) + "/chat";
    var body = JSON.stringify({
      message: text,
      visitor_id: visitorId,
      metadata: {},
    });
    return fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
      },
      15000
    )
      .then(function (res) {
        if (!res.ok) throw new Error("Chat response " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data.session_id) sessionId = data.session_id;
        return data.answer || "";
      });
  }

  function fetchWithTimeout(url, opts, ms) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error("Timeout"));
      }, ms);

      fetch(url, opts)
        .then(function (res) {
          clearTimeout(timer);
          resolve(res);
        })
        .catch(function (err) {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  function sendMessage() {
    var text = (inputEl.value || "").trim();
    if (!text || isTyping) return;

    inputEl.value = "";
    appendMessage({ role: "user", content: text });
    showTyping();
    inputEl.disabled = true;
    sendBtn.disabled = true;

    sendChatMessage(text)
      .then(function (answer) {
        hideTyping();
        var reply = answer || "\u2026";
        appendMessage({ role: "bot", content: reply });
        incrementUnread();
      })
      .catch(function () {
        hideTyping();
        appendMessage({
          role: "bot",
          content: "\u9001\u4FE1\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002",
        });
      })
      .finally(function () {
        inputEl.disabled = false;
        sendBtn.disabled = false;
        inputEl.focus();
      });
  }

  function init() {
    injectStyles();
    buildDOM();

    fetchConfig().then(function () {
      ensureFont();
      applyStyles();

      // Add welcome message
      if (config && config.welcome_message && !configError) {
        appendMessage({ role: "bot", content: config.welcome_message });
      }
    });

    // Listen for theme changes (auto mode)
    if (dataTheme === "auto" && window.matchMedia) {
      try {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
          applyStyles();
          renderAllMessages();
        });
      } catch (_) {
        /* older browsers */
      }
    }

    // Re-apply sizing on resize for mobile responsiveness
    window.addEventListener("resize", applyStyles);
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
