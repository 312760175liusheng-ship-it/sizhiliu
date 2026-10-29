/* ==========================================================================
   Immersive review (focus mode)
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const util = SZL.util;
  const model = SZL.model;
  const views = (SZL.views = SZL.views || {});

  const RATING_WORDS = ["还没打分", "浪费了", "翻过", "还行", "有收获", "击中我"];

  views.openFocus = function openFocus(ctx) {
    const store = ctx.store;
    const app = ctx.app;
    let list = (ctx.pool && ctx.pool.length ? ctx.pool : store.items()).slice();
    if (!list.length) {
      SZL.toast("还没有可以回看的内容。");
      return null;
    }
    let index = ctx.startId ? list.findIndex((item) => item.id === ctx.startId) : 0;
    if (index < 0) index = 0;
    let item = list[index];
    let closed = false;
    let saveTimer = null;
    let hideTimer = null;
    let switching = false;

    const root = util.el("div", {
      class: "focus-overlay",
      attrs: {
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "沉浸回顾",
        tabindex: "-1",
      },
    });
    const ambient = util.el("div", { class: "focus-ambient", attrs: { "aria-hidden": "true" } });

    const countTop = util.el("span", { class: "focus-count", text: "" });
    const top = util.el("header", { class: "focus-top" }, [
      util.el("div", { class: "focus-brand" }, [
        util.el("span", { class: "focus-mark", text: "思" }),
        util.el("span", { text: "沉浸回顾" }),
        countTop,
      ]),
      util.el("span", {
        class: "focus-top-hint",
        text: "← → 切换 · Esc 退出 · ⌘↵ 写下并继续",
      }),
      util.el("button", {
        class: "btn btn-ghost btn-sm focus-close",
        attrs: { type: "button", "aria-label": "退出沉浸回顾" },
        html: util.icon("close", 12) + "<span>退出</span>",
        on: { click: () => close() },
      }),
    ]);

    const media = util.el("div", { class: "focus-media" });
    const mediaImg = util.el("img", { attrs: { alt: "", referrerpolicy: "no-referrer" } });
    const mediaFallback = util.el("div", { class: "focus-media-fallback" });
    const mediaBadge = util.el("span", { class: "source-badge" });
    const mediaDuration = util.el("span", { class: "media-duration", text: "" });
    media.appendChild(mediaImg);
    media.appendChild(mediaFallback);
    media.appendChild(mediaBadge);
    media.appendChild(mediaDuration);

    const eyebrow = util.el("div", { class: "eyebrow focus-eyebrow" });
    const title = util.el("h1", { class: "focus-title" });
    const summary = util.el("p", { class: "focus-summary" });

    const ratingRow = util.el("div", { class: "focus-rating-row" });
    const rating = util.el("div", {
      class: "rating rating-lg",
      attrs: { role: "group", "aria-label": "评分" },
    });
    const ratingWord = util.el("span", { class: "rating-word" });
    ratingRow.appendChild(util.el("span", { class: "focus-label", text: "这次回看" }));
    ratingRow.appendChild(rating);
    ratingRow.appendChild(ratingWord);

    const note = util.el("textarea", {
      class: "focus-note",
      attrs: {
        rows: "4",
        placeholder: "这一刻，你想留下什么？一句话也好。",
        "aria-label": "写下感想",
      },
    });
    const saveState = util.el("span", { class: "save-note", text: "已保存" });
    const noteCount = util.el("span", { class: "focus-count-note", text: "" });
    const noteMeta = util.el("div", { class: "focus-note-meta" }, [saveState, noteCount]);

    const tagRow = util.el("div", { class: "focus-tags" });
    const tagInput = util.el("input", {
      class: "focus-tag-input",
      attrs: { type: "text", placeholder: "＋ 标签", "aria-label": "添加标签" },
    });
    tagRow.appendChild(tagInput);

    const sourceLink = util.el("a", {
      class: "focus-link",
      attrs: { target: "_blank", rel: "noopener noreferrer" },
      html: "<span>打开原链接</span>" + util.icon("external", 11),
    });
    const doneBtn = util.el("button", {
      class: "btn btn-primary focus-done",
      attrs: { type: "button" },
      html: "<span>写好了，继续</span>" + util.icon("arrowRight", 13),
      on: {
        click: () => {
          commitNote();
          if (index === list.length - 1) close();
          else next();
        },
      },
    });
    const actions = util.el("div", { class: "focus-actions" }, [sourceLink, doneBtn]);

    const panel = util.el("div", { class: "focus-panel" }, [
      eyebrow,
      title,
      summary,
      util.el("div", { class: "focus-divider" }),
      ratingRow,
      note,
      noteMeta,
      tagRow,
      actions,
    ]);

    const stage = util.el("div", { class: "focus-stage" }, [media, panel]);

    const prevBtn = util.el("button", {
      class: "focus-nav",
      attrs: { type: "button", "aria-label": "上一条" },
      html: util.icon("arrowLeft", 12) + "<span>上一条</span>",
      on: { click: () => prev() },
    });
    const progress = util.el("span", { class: "focus-progress", text: "" });
    const nextBtn = util.el("button", {
      class: "focus-nav",
      attrs: { type: "button", "aria-label": "下一条" },
      html: "<span>下一条</span>" + util.icon("arrowRight", 12),
      on: { click: () => next() },
    });
    const bottom = util.el("footer", { class: "focus-bottom" }, [prevBtn, progress, nextBtn]);

    root.appendChild(ambient);
    root.appendChild(top);
    root.appendChild(stage);
    root.appendChild(bottom);
    document.getElementById("overlay-root").appendChild(root);
    document.documentElement.style.overflow = "hidden";
    const lastFocus = document.activeElement;

    /* ---------------- render ---------------- */

    function updateAmbient() {
      if (item.cover) {
        ambient.style.backgroundImage = 'url("' + encodeURI(item.cover) + '")';
        ambient.style.opacity = "";
      } else {
        ambient.style.backgroundImage = "";
      }
    }

    function renderBadge() {
      const meta = model.sourceMeta(item.source);
      const icon = SZL.brand ? SZL.brand.icon(item.source, 15) : "";
      util.clear(mediaBadge);
      mediaBadge.style.setProperty("--src-color", meta.color);
      mediaBadge.setAttribute("title", "来源：" + meta.label);
      if (icon) {
        mediaBadge.appendChild(util.el("span", { class: "source-icon", html: icon }));
      }
      mediaBadge.appendChild(util.el("span", { class: "source-label", text: meta.label }));
    }

    function renderRating() {
      util.clear(rating);
      const value = item.review.rating || 0;
      for (let i = 1; i <= 5; i++) {
        const dot = util.el("button", {
          class: "rating-dot" + (i <= value ? " is-on" : ""),
          attrs: {
            type: "button",
            "aria-label": i + " 分 · " + RATING_WORDS[i],
            title: RATING_WORDS[i],
          },
          on: {
            click: () => {
              const nextValue = (item.review.rating || 0) === i ? 0 : i;
              commitNote();
              store.setReview(item.id, { rating: nextValue });
              renderRating();
            },
            mouseenter: () => previewRating(i),
          },
        });
        rating.appendChild(dot);
      }
      rating.addEventListener("mouseleave", () => previewRating(0));
      ratingWord.textContent = RATING_WORDS[value];
      ratingWord.dataset.empty = value ? "false" : "true";
    }

    function previewRating(value) {
      const current = item.review.rating || 0;
      Array.from(rating.children).forEach((dot, i) => {
        dot.classList.toggle("is-preview", value > 0 && i < value);
        dot.classList.toggle("is-on", value === 0 && i < current);
      });
      ratingWord.textContent = value ? RATING_WORDS[value] : RATING_WORDS[current];
      ratingWord.dataset.empty = (value || current) ? "false" : "true";
    }

    function renderTags() {
      Array.from(tagRow.querySelectorAll(".tag-chip")).forEach((chip) => chip.remove());
      (item.review.tags || []).forEach((tag) => {
        tagRow.insertBefore(
          util.el("span", { class: "tag-chip" }, [
            util.el("span", { class: "tag-hash", text: "#" }),
            util.el("span", { text: tag }),
            util.el("button", {
              attrs: { type: "button", "aria-label": "移除标签 " + tag },
              html: util.icon("close", 8),
              on: {
                click: () => {
                  const tags = (item.review.tags || []).filter((t) => t !== tag);
                  store.setReview(item.id, { tags });
                  renderTags();
                },
              },
            }),
          ]),
          tagInput
        );
      });
    }

    function autosize() {
      note.style.height = "auto";
      note.style.height = Math.min(note.scrollHeight + 2, 280) + "px";
    }

    function updateCount() {
      const len = note.value.trim().length;
      noteCount.textContent = len ? len + " 字" : "";
    }

    function showSave(saving) {
      clearTimeout(hideTimer);
      saveState.classList.add("is-visible");
      saveState.classList.toggle("is-saving", !!saving);
      saveState.textContent = saving ? "保存中" : "已保存";
      if (!saving) hideTimer = setTimeout(() => saveState.classList.remove("is-visible"), 1500);
    }

    function commitNote() {
      clearTimeout(saveTimer);
      if (note.value === (item.review.note || "")) return;
      showSave(true);
      store.setReview(item.id, { note: note.value });
      showSave(false);
    }

    function render() {
      const meta = model.sourceMeta(item.source);
      util.clear(eyebrow);
      eyebrow.appendChild(util.el("span", { text: meta.label }));
      eyebrow.appendChild(util.el("span", { class: "focus-dot" }));
      eyebrow.appendChild(
        util.el("span", { text: util.formatStamp(item.likedAt) + " 收藏" })
      );
      if (item.author) {
        eyebrow.appendChild(util.el("span", { class: "focus-dot" }));
        eyebrow.appendChild(util.el("span", { text: item.author }));
      }

      title.textContent = item.title;
      summary.textContent = item.summary || "";
      summary.style.display = item.summary ? "" : "none";

      if (item.cover) {
        mediaImg.style.display = "";
        mediaImg.src = item.cover;
        mediaFallback.style.display = "none";
      } else {
        mediaImg.style.display = "none";
        mediaFallback.style.display = "flex";
        util.clear(mediaFallback);
        mediaFallback.appendChild(
          util.el("span", { class: "focus-fallback-src", text: meta.label })
        );
        mediaFallback.appendChild(
          util.el("span", { class: "focus-fallback-title", text: util.truncate(item.title, 40) })
        );
      }
      mediaDuration.textContent = item.duration || "";
      renderBadge();
      renderRating();
      note.value = item.review.note || "";
      updateCount();
      autosize();
      renderTags();
      if (item.url) {
        sourceLink.href = item.url;
        sourceLink.style.display = "";
      } else {
        sourceLink.style.display = "none";
      }
      progress.textContent =
        String(index + 1).padStart(2, "0") + " / " + String(list.length).padStart(2, "0");
      countTop.textContent =
        String(index + 1).padStart(2, "0") + " / " + String(list.length).padStart(2, "0");
      updateAmbient();
      doneBtn.querySelector("span").textContent =
        index === list.length - 1 ? "写好了，回到回看" : "写好了，继续";
    }

    /* ---------------- navigation ---------------- */

    function switchTo(nextIndex) {
      if (switching) return;
      commitNote();
      switching = true;
      stage.classList.add("is-switching");
      setTimeout(() => {
        index = (nextIndex + list.length) % list.length;
        item = list[index];
        render();
        stage.classList.remove("is-switching");
        switching = false;
      }, 190);
    }

    function next() {
      switchTo(index + 1);
    }
    function prev() {
      switchTo(index - 1);
    }

    function close() {
      if (closed) return;
      closed = true;
      commitNote();
      document.removeEventListener("keydown", onKey, true);
      root.classList.remove("is-open");
      root.classList.add("is-closing");
      setTimeout(() => {
        root.remove();
        document.documentElement.style.overflow = "";
        if (lastFocus && lastFocus.focus) {
          try {
            lastFocus.focus({ preventScroll: true });
          } catch (err) {
            /* ignore */
          }
        }
      }, 260);
    }

    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      const tag = (event.target && event.target.tagName) || "";
      const typing = /INPUT|TEXTAREA/.test(tag) || (event.target && event.target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        commitNote();
        next();
        return;
      }
      if (typing) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        prev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      }
    }

    /* ---------------- events ---------------- */

    note.addEventListener("input", () => {
      updateCount();
      autosize();
      commitNote();
    });
    note.addEventListener("blur", commitNote);
    note.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        note.blur();
      }
    });

    tagInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const tag = model.normalizeTag(tagInput.value);
        if (!tag) return;
        const tags = (item.review.tags || []).slice();
        if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
          tags.push(tag);
          store.setReview(item.id, { tags });
          renderTags();
        }
        tagInput.value = "";
      } else if (event.key === "Backspace" && !tagInput.value) {
        const tags = (item.review.tags || []).slice();
        if (tags.length) {
          tags.pop();
          store.setReview(item.id, { tags });
          renderTags();
        }
      }
    });

    document.addEventListener("keydown", onKey, true);

    render();
    util.nextFrame(() => {
      root.classList.add("is-open");
      root.focus({ preventScroll: true });
    });

    return { el: root, close };
  };
})();
