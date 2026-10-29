/* ==========================================================================
   Card component: media, metadata, review editor, tags
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const util = SZL.util;
  const model = SZL.model;
  const views = (SZL.views = SZL.views || {});

  const RATING_WORDS = ["还没打分", "浪费了", "翻过", "还行", "有收获", "击中我"];
  views.RATING_WORDS = RATING_WORDS;

  function ratingValue(item) {
    return (item.review && item.review.rating) || 0;
  }

  function ratingWord(value) {
    return RATING_WORDS[util.clamp(value || 0, 0, 5)];
  }

  function sourceBadge(item) {
    const meta = model.sourceMeta(item.source);
    const icon = SZL.brand ? SZL.brand.icon(item.source, 15) : "";
    return util.el("span", {
      class: "source-badge",
      style: { "--src-color": meta.color },
      attrs: { title: "来源：" + meta.label },
    }, [
      icon ? util.el("span", { class: "source-icon", html: icon }) : null,
      util.el("span", { class: "source-label", text: meta.label }),
    ]);
  }

  function media(item) {
    const node = util.el("a", {
      class: "card-media",
      attrs: {
        href: item.url || "#",
        target: item.url ? "_blank" : null,
        rel: "noopener noreferrer",
        "aria-label": "打开原链接：" + item.title,
        tabindex: item.url ? "0" : "-1",
      },
      on: {
        click: (event) => {
          if (!item.url) event.preventDefault();
        },
      },
    });

    if (item.cover) {
      const img = util.el("img", {
        attrs: {
          src: item.cover,
          alt: "",
          loading: "lazy",
          decoding: "async",
          referrerpolicy: "no-referrer",
        },
      });
      const markLoaded = () => img.classList.add("is-loaded");
      const markBroken = () => {
        img.classList.add("is-broken");
        node.appendChild(fallback(item));
      };
      img.addEventListener("load", markLoaded, { once: true });
      img.addEventListener("error", markBroken, { once: true });
      if (img.complete && img.naturalWidth) markLoaded();
      node.appendChild(img);
    } else {
      node.appendChild(fallback(item));
    }

    node.appendChild(sourceBadge(item));

    if (model.isReviewed(item)) {
      node.appendChild(
        util.el("span", {
          class: "reviewed-mark",
          attrs: { title: "已经回看过", "aria-label": "已回看" },
          html: util.icon("check", 10),
        })
      );
    }

    if (item.duration) {
      node.appendChild(util.el("span", { class: "media-duration", text: item.duration }));
    }

    return { el: node, setCover: (cover) => updateCover(node, item) };
  }

  function fallback(item) {
    const meta = model.sourceMeta(item.source);
    let host = "";
    try {
      host = new URL(item.url).hostname.replace(/^www\./, "");
    } catch (err) {
      host = "";
    }
    return util.el(
      "div",
      {
        class: "media-fallback",
        style: { "--src-color": meta.color },
      },
      [
        util.el("span", {
          class: "media-fallback-glyph",
          text: meta.label.slice(0, 1),
          attrs: { "aria-hidden": "true" },
        }),
        util.el("div", { class: "media-fallback-copy" }, [
          util.el("span", { class: "media-fallback-src", text: meta.label }),
          util.el("span", {
            class: "media-fallback-host",
            text: host || "手动记录",
          }),
        ]),
      ]
    );
  }

  function updateCover(mediaEl, item) {
    if (!item.cover) return;
    let img = mediaEl.querySelector("img");
    if (!img) {
      const old = mediaEl.querySelector(".media-fallback");
      if (old) old.remove();
      img = util.el("img", {
        attrs: { src: item.cover, alt: "", loading: "lazy", referrerpolicy: "no-referrer" },
      });
      img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
      mediaEl.insertBefore(img, mediaEl.firstChild);
    } else if (img.getAttribute("src") !== item.cover) {
      img.classList.remove("is-loaded");
      img.setAttribute("src", item.cover);
    }
  }

  function miniRating(value) {
    const wrap = util.el("span", {
      class: "rating",
      attrs: { "aria-label": "评分 " + value + " / 5" },
    });
    for (let i = 1; i <= 5; i++) {
      wrap.appendChild(
        util.el("span", { class: "rating-dot" + (i <= value ? " is-on" : "") })
      );
    }
    return wrap;
  }

  function renderTagChips(container, item, ctx) {
    util.clear(container);
    (item.review.tags || []).forEach((tag) => {
      container.appendChild(
        util.el(
          "button",
          {
            class: "tag",
            attrs: { type: "button", title: "查看标签 " + tag },
            on: {
              click: (event) => {
                event.stopPropagation();
                if (ctx.onTagClick) ctx.onTagClick(tag);
              },
            },
          },
          tag.split("/").map((part, index, arr) => [
            index ? util.el("span", { class: "tag-slash", text: "/" }) : null,
            util.el("span", { text: part }),
          ])
        )
      );
    });
  }

  views.createCard = function createCard(item, ctx) {
    const state = { open: false, detail: null, item };
    const card = util.el("article", {
      class: "card",
      dataset: { id: item.id, shape: item.shape || "square" },
      attrs: { "aria-label": item.title },
    });
    card.classList.toggle("has-no-cover", !item.cover);
    if (typeof ctx.index === "number") {
      card.style.animationDelay = Math.min(ctx.index * 35, 420) + "ms";
    }

    /* ----- media ----- */
    const mediaNode = media(item);
    card.appendChild(mediaNode.el);

    /* ----- body ----- */
    const body = util.el("div", { class: "card-body" });
    const metaRow = util.el("div", { class: "card-src" });
    const titleBtn = util.el("button", {
      class: "card-title",
      attrs: { type: "button", title: "展开这条回顾" },
      on: {
        click: () => api.toggle(),
      },
    });
    const summary = util.el("p", { class: "card-summary" });

    const preview = util.el("div", { class: "card-preview" });
    const thought = util.el("div", { class: "card-thought" });
    const thoughtHead = util.el("div", { class: "thought-head" });
    const thoughtBody = util.el("div", { class: "thought-body" });
    const tagRow = util.el("div", { class: "card-tags" });
    preview.appendChild(thought);
    thought.appendChild(thoughtHead);
    thought.appendChild(thoughtBody);

    const foot = util.el("div", { class: "card-foot" });
    const copyBtn = util.el("button", {
      class: "card-act",
      attrs: { type: "button", title: "复制标题" },
      html: util.icon("copy", 11) + "<span>复制标题</span>",
      on: { click: () => copyTitle() },
    });
    const openLink = util.el("a", {
      class: "card-act",
      attrs: { href: item.url || "#", target: "_blank", rel: "noopener noreferrer" },
      html: util.icon("external", 11) + "<span>原链接</span>",
    });
    const expandBtn = util.el("button", {
      class: "card-act card-act-pill spacer",
      attrs: { type: "button", title: "展开这条回顾" },
      html: util.icon("chevron", 12) + "<span>展开回顾</span>",
      on: { click: () => api.toggle() },
    });
    foot.appendChild(copyBtn);
    if (item.url) foot.appendChild(openLink);
    foot.appendChild(expandBtn);

    body.appendChild(metaRow);
    body.appendChild(titleBtn);
    body.appendChild(summary);
    body.appendChild(preview);
    preview.appendChild(tagRow);
    preview.appendChild(foot);
    card.appendChild(body);

    /* ----- detail (lazy) ----- */
    function ensureDetail() {
      if (state.detail) return state.detail;
      const detail = util.el("div", { class: "card-detail" });

      // rating
      const ratingBlock = util.el("div", { class: "detail-block" });
      const ratingHead = util.el("div", { class: "detail-head" }, [
        util.el("span", { class: "detail-label", text: "这次回看，值得几分" }),
        util.el("span", { class: "rating-word" }),
      ]);
      const ratingRow = util.el("div", { class: "rating-row" });
      const bigRating = util.el("div", { class: "rating rating-lg", attrs: { role: "group", "aria-label": "评分" } });
      const dotButtons = [];
      for (let i = 1; i <= 5; i++) {
        const dot = util.el("button", {
          class: "rating-dot",
          attrs: { type: "button", "aria-label": i + " 分 · " + RATING_WORDS[i], title: RATING_WORDS[i] },
          on: {
            click: () => {
              const next = ratingValue(item) === i ? 0 : i;
              setRating(next);
            },
            mouseenter: () => previewRating(i),
          },
        });
        dotButtons.push(dot);
        bigRating.appendChild(dot);
      }
      bigRating.addEventListener("mouseleave", () => previewRating(0));
      const ratingWordEl = ratingHead.querySelector(".rating-word");
      ratingRow.appendChild(bigRating);
      ratingRow.appendChild(ratingWordEl);
      ratingBlock.appendChild(ratingHead);
      ratingBlock.appendChild(ratingRow);

      // note
      const noteBlock = util.el("div", { class: "detail-block" });
      const noteHead = util.el("div", { class: "detail-head" }, [
        util.el("span", { class: "detail-label", text: "我的感想" }),
        util.el("span", { class: "save-note", text: "已保存" }),
      ]);
      const noteInput = util.el("textarea", {
        class: "note-input",
        attrs: {
          placeholder: "此刻想到什么？一句话也好。",
          "aria-label": "写下此刻的想法",
          rows: "4",
        },
      });
      noteInput.value = item.review.note || "";
      const noteMeta = util.el("div", { class: "note-meta" }, [
        util.el("span", { text: "自动保存在本地，不用点保存。" }),
        util.el("span", { class: "note-count", text: "" }),
      ]);

      // tags
      const tagBlock = util.el("div", { class: "detail-block" });
      const tagHead = util.el("div", { class: "detail-head" }, [
        util.el("span", { class: "detail-label", text: "标签" }),
        util.el("span", { class: "detail-note", text: "支持 父/子 的写法" }),
      ]);
      const tagEditor = util.el("div", { class: "tag-editor" });
      const tagSuggest = util.el("div", { class: "tag-suggest", attrs: { role: "listbox" } });
      const tagInput = util.el("input", {
        class: "tag-add-input",
        attrs: {
          type: "text",
          placeholder: "＋ 添加标签",
          "aria-label": "添加标签",
          autocomplete: "off",
        },
      });
      tagEditor.appendChild(tagInput);
      tagEditor.appendChild(tagSuggest);

      // actions
      const actions = util.el("div", { class: "open-actions" });
      const collapseBtn = util.el("button", {
        class: "card-act card-act-pill",
        attrs: { type: "button" },
        html: util.icon("chevronUp", 12) + "<span>收起</span>",
        on: { click: () => api.collapse() },
      });
      const editBtn = util.el("button", {
        class: "card-act",
        attrs: { type: "button" },
        html: util.icon("edit", 11) + "<span>编辑信息</span>",
        on: { click: () => ctx.onEdit && ctx.onEdit(state.item) },
      });
      const copyExpanded = util.el("button", {
        class: "card-act",
        attrs: { type: "button", title: "复制标题" },
        html: util.icon("copy", 11) + "<span>复制标题</span>",
        on: { click: () => copyTitle() },
      });
      const deleteBtn = util.el("button", {
        class: "card-act is-danger spacer",
        attrs: { type: "button" },
        html: util.icon("trash", 11) + "<span>移出回顾</span>",
        on: { click: () => ctx.onDelete && ctx.onDelete(state.item) },
      });
      actions.appendChild(collapseBtn);
      actions.appendChild(copyExpanded);
      if (item.url) {
        actions.appendChild(
          util.el("a", {
            class: "card-act",
            attrs: { href: item.url, target: "_blank", rel: "noopener noreferrer" },
            html: util.icon("external", 11) + "<span>原链接</span>",
          })
        );
      }
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      detail.appendChild(ratingBlock);
      detail.appendChild(noteBlock);
      detail.appendChild(tagBlock);
      detail.appendChild(actions);
      noteBlock.appendChild(noteHead);
      noteBlock.appendChild(noteInput);
      noteBlock.appendChild(noteMeta);
      tagBlock.appendChild(tagHead);
      tagBlock.appendChild(tagEditor);

      body.appendChild(detail);
      state.detail = {
        el: detail,
        noteInput,
        noteMeta,
        saveNote: noteHead.querySelector(".save-note"),
        tagEditor,
        tagInput,
        tagSuggest,
        dotButtons,
        ratingWord: ratingWordEl,
        copyExpanded,
      };

      /* ----- note editing ----- */
      let saveTimer = null;
      let hideTimer = null;

      const autosize = () => {
        noteInput.style.height = "auto";
        noteInput.style.height = Math.min(noteInput.scrollHeight + 2, 340) + "px";
      };
      state.detail.autosize = autosize;
      const updateCount = () => {
        const len = noteInput.value.trim().length;
        state.detail.noteMeta.querySelector(".note-count").textContent = len ? len + " 字" : "";
      };
      const showSave = (saving) => {
        const el = state.detail.saveNote;
        clearTimeout(hideTimer);
        el.classList.add("is-visible");
        el.classList.toggle("is-saving", !!saving);
        el.textContent = saving ? "保存中" : "已保存";
        if (!saving) {
          hideTimer = setTimeout(() => el.classList.remove("is-visible"), 1600);
        }
      };
      const commitNote = () => {
        clearTimeout(saveTimer);
        if (noteInput.value === (item.review.note || "")) return;
        showSave(true);
        ctx.store.setReview(item.id, { note: noteInput.value });
        state.item = ctx.store.getItem(item.id) || state.item;
        showSave(false);
        refreshThumbs();
      };

      noteInput.addEventListener("input", () => {
        autosize();
        updateCount();
        commitNote();
      });
      noteInput.addEventListener("blur", commitNote);
      noteInput.addEventListener("keydown", (event) => {
        if (event.key === "Escape") noteInput.blur();
      });
      setTimeout(autosize, 0);
      updateCount();

      /* ----- rating editing ----- */
      function previewRating(value) {
        const current = ratingValue(state.item);
        dotButtons.forEach((dot, index) => {
          dot.classList.toggle("is-preview", value > 0 && index < value);
          dot.classList.toggle("is-on", value === 0 && index < current);
        });
        if (state.detail) {
          state.detail.ratingWord.textContent = value
            ? RATING_WORDS[value]
            : ratingWord(current);
          state.detail.ratingWord.dataset.empty = current ? "false" : "true";
        }
      }

      function setRating(value) {
        ctx.store.setReview(item.id, { rating: value });
        state.item = ctx.store.getItem(item.id) || state.item;
        previewRating(0);
        refreshThumbs();
      }

      state.detail.setRating = setRating;
      state.detail.previewRating = previewRating;

      /* ----- tag editing ----- */
      let activeSuggestion = -1;
      let suggestions = [];

      function renderTagEditor() {
        Array.from(tagEditor.querySelectorAll(".tag-chip")).forEach((chip) => chip.remove());
        (state.item.review.tags || []).forEach((tag) => {
          const chip = util.el("span", { class: "tag-chip" }, [
            util.el("span", { class: "tag-hash", text: "#" }),
            util.el("span", { text: tag }),
            util.el("button", {
              attrs: { type: "button", "aria-label": "移除标签 " + tag },
              html: util.icon("close", 8),
              on: {
                click: () => {
                  const next = (state.item.review.tags || []).filter((t) => t !== tag);
                  ctx.store.setReview(item.id, { tags: next });
                  state.item = ctx.store.getItem(item.id) || state.item;
                  renderTagEditor();
                  tagInput.focus();
                },
              },
            }),
          ]);
          tagEditor.insertBefore(chip, tagInput);
        });
      }

      function hideSuggest() {
        tagSuggest.classList.remove("is-open");
        activeSuggestion = -1;
      }

      function showSuggest() {
        const query = tagInput.value.trim();
        const existing = new Set(state.item.review.tags || []);
        suggestions = ctx.store
          .tagOptions()
          .filter((tag) => !existing.has(tag.path))
          .filter((tag) => !query || tag.path.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 7);
        util.clear(tagSuggest);
        activeSuggestion = -1;
        if (!suggestions.length) {
          hideSuggest();
          return;
        }
        suggestions.forEach((tag, index) => {
          const option = util.el(
            "button",
            {
              attrs: { type: "button", role: "option" },
              on: {
                mousedown: (event) => event.preventDefault(),
                click: () => addTag(tag.path),
              },
            },
            [
              util.el("span", { text: tag.path }),
              util.el("span", { text: tag.total + " 条" }),
            ]
          );
          option.dataset.index = String(index);
          tagSuggest.appendChild(option);
        });
        tagSuggest.classList.add("is-open");
      }

      function addTag(raw) {
        const tag = model.normalizeTag(raw);
        if (!tag) return;
        const tags = (state.item.review.tags || []).slice();
        if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
          tagInput.value = "";
          hideSuggest();
          return;
        }
        tags.push(tag);
        ctx.store.setReview(item.id, { tags });
        state.item = ctx.store.getItem(item.id) || state.item;
        tagInput.value = "";
        renderTagEditor();
        hideSuggest();
        tagInput.focus();
      }

      tagInput.addEventListener("input", showSuggest);
      tagInput.addEventListener("focus", showSuggest);
      tagInput.addEventListener("blur", () => setTimeout(hideSuggest, 120));
      tagInput.addEventListener("keydown", (event) => {
        const options = Array.from(tagSuggest.querySelectorAll("button"));
        if (event.key === "ArrowDown" && options.length) {
          event.preventDefault();
          activeSuggestion = (activeSuggestion + 1) % options.length;
          options.forEach((o, i) => o.classList.toggle("is-active", i === activeSuggestion));
        } else if (event.key === "ArrowUp" && options.length) {
          event.preventDefault();
          activeSuggestion = (activeSuggestion - 1 + options.length) % options.length;
          options.forEach((o, i) => o.classList.toggle("is-active", i === activeSuggestion));
        } else if (event.key === "Enter") {
          event.preventDefault();
          if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
            addTag(suggestions[activeSuggestion].path);
          } else {
            addTag(tagInput.value);
          }
        } else if (event.key === "Escape") {
          hideSuggest();
        } else if (event.key === "Backspace" && !tagInput.value) {
          const tags = (state.item.review.tags || []).slice();
          if (tags.length) {
            tags.pop();
            ctx.store.setReview(item.id, { tags });
            state.item = ctx.store.getItem(item.id) || state.item;
            renderTagEditor();
          }
        }
      });

      renderTagEditor();
      previewRating(0);
      return state.detail;
    }

    /* ----- footer/render ----- */
    function metaText() {
      util.clear(metaRow);
      const meta = model.sourceMeta(item.source);
      metaRow.appendChild(util.el("span", { class: "src-name", text: meta.label }));
      metaRow.appendChild(util.el("span", { class: "sep" }));
      metaRow.appendChild(
        util.el("span", {
          class: "src-time",
          text: util.formatStamp(item.likedAt) + " 收藏",
        })
      );
      if (item.author) {
        metaRow.appendChild(util.el("span", { class: "sep" }));
        metaRow.appendChild(util.el("span", { class: "src-author", text: item.author }));
      }
    }

    function refreshPreview() {
      const note = (item.review && item.review.note) || "";
      util.clear(thoughtHead);
      util.clear(thoughtBody);
      if (note) {
        thoughtHead.appendChild(miniRating(ratingValue(item)));
        util.clear(thoughtBody);
        thoughtBody.appendChild(util.el("p", { class: "thought-quote", text: note }));
      } else {
        const empty = util.el("button", {
          class: "thought-empty",
          attrs: { type: "button" },
          on: { click: (event) => { event.stopPropagation(); api.expand(); } },
        });
        if (ratingValue(item) > 0) {
          thoughtHead.appendChild(miniRating(ratingValue(item)));
          util.clear(thoughtBody);
          empty.innerHTML = util.icon("plus", 11) + "<span>补一句感想</span>";
          thoughtBody.appendChild(empty);
        } else {
          util.clear(thoughtHead);
          util.clear(thoughtBody);
          empty.innerHTML = util.icon("plus", 11) + "<span>写下此刻的想法</span>";
          thoughtHead.appendChild(empty);
        }
      }
      renderTagChips(tagRow, item, ctx);
    }

    function refreshThumbs() {
      const reviewed = model.isReviewed(state.item);
      const mark = mediaNode.el.querySelector(".reviewed-mark");
      if (reviewed && !mark) {
        mediaNode.el.appendChild(
          util.el("span", {
            class: "reviewed-mark",
            attrs: { title: "已经回看过", "aria-label": "已回看" },
            html: util.icon("check", 10),
          })
        );
      } else if (!reviewed && mark) {
        mark.remove();
      }
      if (!state.open) refreshPreview();
      if (state.detail) {
        const r = ratingValue(state.item);
        state.detail.dotButtons.forEach((dot, index) =>
          dot.classList.toggle("is-on", index < r)
        );
        state.detail.ratingWord.textContent = ratingWord(r);
        state.detail.ratingWord.dataset.empty = r ? "false" : "true";
      }
    }

    function sync() {
      state.item = ctx.store.getItem(item.id) || state.item;
      metaText();
      titleBtn.textContent = state.item.title;
      summary.textContent = state.item.summary || "";
      titleBtn.title = state.item.title;
      card.setAttribute("aria-label", state.item.title);
      card.classList.toggle("has-no-cover", !state.item.cover);
      if (state.item.cover) {
        updateCover(mediaNode.el, state.item);
      } else {
        const img = mediaNode.el.querySelector("img");
        if (img) img.remove();
        if (!mediaNode.el.querySelector(".media-fallback")) {
          mediaNode.el.insertBefore(fallback(state.item), mediaNode.el.firstChild);
        }
      }
      const openLinkEls = card.querySelectorAll('a[href]');
      openLinkEls.forEach((a) => {
        a.setAttribute("href", state.item.url || "#");
      });
      if (state.detail) {
        if (document.activeElement !== state.detail.noteInput) {
          state.detail.noteInput.value = state.item.review.note || "";
        }
        refreshThumbs();
      }
      refreshPreview();
    }

    async function copyTitle() {
      try {
        await util.copyText(state.item.title);
        const btn = state.detail && state.detail.copyExpanded
          ? state.detail.copyExpanded
          : copyBtn;
        const label = btn && btn.querySelector("span");
        if (label) {
          const old = label.textContent;
          label.textContent = "已复制";
          btn.classList.add("is-copied");
          setTimeout(() => {
            label.textContent = old;
            btn.classList.remove("is-copied");
          }, 1400);
        }
        if (SZL.toast) SZL.toast("标题已复制：" + util.truncate(state.item.title, 24), { icon: "check" });
      } catch (err) {
        SZL.toast("复制失败，请手动选择标题", { type: "error" });
      }
    }

    const api = {
      el: card,
      itemId: item.id,
      get item() {
        return state.item;
      },
      isOpen: () => state.open,
      expand: () => setOpen(true),
      collapse: () => setOpen(false),
      toggle: () => setOpen(!state.open),
      sync,
      refresh: sync,
      flash: () => {
        card.classList.remove("is-flash");
        void card.offsetWidth;
        card.classList.add("is-flash");
        setTimeout(() => card.classList.remove("is-flash"), 1900);
      },
      focus: () => {
        if (ctx.onToggle) ctx.onToggle(card, state.open);
      },
      setOpen,
    };

    function setOpen(next, silent) {
      const value = !!next;
      if (value === state.open) return;
      if (!silent && ctx.onBeforeToggle) ctx.onBeforeToggle(card, value);
      state.open = value;
      if (value) ensureDetail();
      card.classList.toggle("is-open", value);
      expandBtn.querySelector("span").textContent = value ? "收起" : "展开回顾";
      if (value) {
        titleBtn.setAttribute("aria-expanded", "true");
        refreshThumbs();
        if (state.detail) {
          requestAnimationFrame(() => state.detail.autosize());
        }
      } else {
        titleBtn.setAttribute("aria-expanded", "false");
        refreshPreview();
      }
      if (!silent && ctx.onToggle) ctx.onToggle(card, value);
    }

    titleBtn.setAttribute("aria-expanded", "false");
    sync();
    return api;
  };
})();
