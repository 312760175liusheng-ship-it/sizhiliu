/* ==========================================================================
   Capture: one link, or a whole list
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const util = SZL.util;
  const model = SZL.model;
  const views = (SZL.views = SZL.views || {});

  views.openCapture = function openCapture(ctx) {
    const store = ctx.store;
    const app = ctx.app;
    const editing = ctx.item || null;
    let mode = "single";
    let submitting = false;
    let lastBulk = { items: [], duplicates: 0, invalid: 0 };

    /* ---------------- single form ---------------- */

    const urlInput = util.el("input", {
      class: "field",
      attrs: {
        type: "text",
        inputmode: "url",
        placeholder: "粘贴链接，或整段分享文字",
        autocomplete: "off",
        spellcheck: "false",
      },
    });
    const sourceChip = util.el("span", { class: "detect-chip" });
    const urlHint = util.el("span", {
      class: "url-hint",
      text: "支持直接粘贴分享文字，会自动找出链接",
    });
    const readBtn = util.el("button", {
      class: "inline-action",
      attrs: { type: "button" },
      text: "自动读取",
    });
    const titleInput = util.el("input", {
      class: "field",
      attrs: {
        type: "text",
        placeholder: "给它一个标题",
        maxlength: "160",
        autofocus: "",
      },
    });
    const summaryInput = util.el("textarea", {
      class: "field",
      attrs: { rows: "3", placeholder: "一句话摘要：它讲了什么？为什么值得留下？", maxlength: "600" },
    });
    const authorInput = util.el("input", {
      class: "field",
      attrs: { type: "text", placeholder: "作者 / UP 主（可选）", maxlength: "80" },
    });
    const timeInput = util.el("input", {
      class: "field",
      attrs: { type: "datetime-local" },
    });
    const tagsInput = util.el("input", {
      class: "field",
      attrs: { type: "text", placeholder: "设计/排版, 认知/注意力（逗号分隔，可选）" },
    });
    const coverInput = util.el("input", {
      class: "field",
      attrs: { type: "url", placeholder: "封面图地址（可选）" },
    });
    const errorLine = util.el("p", { class: "form-error" });

    const urlField = util.el("div", { class: "input-with-action" }, [urlInput, readBtn]);
    const sourceRow = util.el("div", { class: "url-meta" }, [sourceChip, urlHint]);

    const more = util.el("details", { class: "form-more" });
    more.appendChild(util.el("summary", { text: "更多信息" }));
    const moreBody = util.el("div", { class: "form-stack form-more-body" });
    moreBody.appendChild(
      util.el("div", { class: "form-row" }, [
        util.el("div", {}, [
          util.el("div", { class: "field-label", text: "作者" }),
          authorInput,
        ]),
        util.el("div", {}, [
          util.el("div", { class: "field-label", text: "收藏时间" }),
          timeInput,
        ]),
      ])
    );
    moreBody.appendChild(
      util.el("div", {}, [
        util.el("div", { class: "field-label", text: "封面图地址" }),
        coverInput,
      ])
    );
    more.appendChild(moreBody);

    const singlePane = util.el("div", { class: "capture-pane" }, [
      util.el("div", { class: "form-stack" }, [
        util.el("div", {}, [
          util.el("div", { class: "field-label" }, [
            util.el("span", { text: "链接" }),
            util.el("span", {
              class: "field-hint",
              text: "支持 B站 / 小红书 / 知乎 / 公众号 / 抖音 / 微博 / 快手 / 网页",
            }),
          ]),
          urlField,
          sourceRow,
        ]),
        util.el("div", {}, [
          util.el("div", { class: "field-label", text: "标题" }),
          titleInput,
        ]),
        util.el("div", {}, [
          util.el("div", { class: "field-label", text: "摘要" }),
          summaryInput,
        ]),
        util.el("div", {}, [
          util.el("div", { class: "field-label" }, [
            util.el("span", { text: "标签" }),
            util.el("span", { class: "field-hint", text: "支持 父/子 的写法" }),
          ]),
          tagsInput,
        ]),
        more,
        errorLine,
      ]),
    ]);

    /* ---------------- bulk pane ---------------- */

    const bulkInput = util.el("textarea", {
      class: "field bulk-area",
      attrs: {
        placeholder:
          "一行一条链接，也可以写成：标题 | https://…\n\n也支持直接粘贴采集器生成的 JSON 数组。",
      },
    });
    const bulkPreview = util.el("div", { class: "bulk-preview" });
    const bulkPane = util.el("div", { class: "capture-pane", attrs: { hidden: "" } }, [
      util.el("div", { class: "form-stack" }, [
        util.el("p", {
          class: "form-note",
          html:
            "一行一条链接，也可以直接粘贴整段分享文字——会自动找出其中的链接、忽略其余文字。也可以写成 <code>标题 | 链接 | 2026-10-01</code>，把点赞日期一起带进来。已有相同链接的记录会被跳过。",
        }),
        bulkInput,
        bulkPreview,
      ]),
    ]);

    /* ---------------- tabs ---------------- */

    const tabs = util.el("div", { class: "capture-tabs", attrs: { role: "tablist" } });
    const tabSingle = util.el("button", {
      class: "capture-tab is-on",
      attrs: { type: "button", role: "tab", "aria-selected": "true" },
      text: "收下一条",
    });
    const tabBulk = util.el("button", {
      class: "capture-tab",
      attrs: { type: "button", role: "tab", "aria-selected": "false" },
      text: "批量收下",
    });
    tabs.appendChild(tabSingle);
    tabs.appendChild(tabBulk);

    function setMode(next) {
      mode = next;
      const single = next === "single";
      tabSingle.classList.toggle("is-on", single);
      tabBulk.classList.toggle("is-on", !single);
      tabSingle.setAttribute("aria-selected", String(single));
      tabBulk.setAttribute("aria-selected", String(!single));
      singlePane.hidden = !single;
      bulkPane.hidden = single;
      updateSubmit();
    }
    tabSingle.addEventListener("click", () => setMode("single"));
    tabBulk.addEventListener("click", () => setMode("bulk"));

    /* ---------------- footer ---------------- */

    const cancelBtn = util.el("button", {
      class: "btn btn-ghost",
      attrs: { type: "button" },
      text: "取消",
      on: { click: () => dlg.close() },
    });
    const submitBtn = util.el("button", {
      class: "btn btn-primary",
      attrs: { type: "button" },
      text: editing ? "保存修改" : "收下这条",
      on: { click: () => submit() },
    });
    const foot = util.el("div", { class: "dialog-submit-row" }, [
      util.el("span", { class: "dialog-submit-hint", text: "Ctrl / ⌘ + Enter 快速提交" }),
      util.el("div", { class: "dialog-submit-actions" }, [cancelBtn, submitBtn]),
    ]);

    const content = util.el("div", { class: "capture" });
    if (!editing) content.appendChild(tabs);
    content.appendChild(singlePane);
    if (!editing) content.appendChild(bulkPane);

    const dlg = SZL.ui.dialog({
      eyebrow: editing ? "编辑这条回顾" : "收下一条",
      title: editing ? "把这条记录改得更准确" : "把看到的，先放进来",
      subtitle: editing
        ? "标题、摘要和链接都可以随时再改。评价与感想写在卡片里。"
        : "标题和链接就够了，其他可以以后补。网页读不到点赞列表，但你可以很快地把链接搬进来。",
      width: "620px",
      className: "capture-dialog",
      content,
      footer: [foot],
    });

    /* ---------------- behaviour ---------------- */

    const URL_HINT_DEFAULT = "支持直接粘贴分享文字，会自动找出链接";
    let hintTimer = null;

    function setUrlHint(text, state) {
      clearTimeout(hintTimer);
      urlHint.textContent = text;
      urlHint.classList.toggle("is-ok", state === "ok");
      urlHint.classList.toggle("is-error", state === "error");
      if (state) {
        hintTimer = setTimeout(() => {
          urlHint.textContent = URL_HINT_DEFAULT;
          urlHint.classList.remove("is-ok", "is-error");
        }, 4200);
      }
    }

    function extractedUrl() {
      return SZL.metadata.extractUrl(urlInput.value);
    }

    function isNoisyText(raw) {
      const text = String(raw || "");
      return /[\u3400-\u9fff]/.test(text) || /\s/.test(text.trim());
    }

    function updateSource() {
      const url = extractedUrl();
      const source = model.detectSource(url);
      const meta = model.sourceMeta(source);
      const icon = SZL.brand ? SZL.brand.icon(source, 12) : "";
      util.clear(sourceChip);
      sourceChip.style.setProperty("--src-color", meta.color);
      if (icon) {
        sourceChip.appendChild(util.el("span", { class: "source-icon", html: icon }));
      }
      sourceChip.appendChild(
        util.el("span", { text: url ? "识别为 " + meta.label : "来源会按链接自动识别" })
      );
    }

    function updateSubmit() {
      if (mode === "bulk" && !editing) {
        const count = lastBulk.items.length;
        submitBtn.textContent = count ? "收下 " + count + " 条" : "收下这些";
        submitBtn.disabled = count === 0;
      } else {
        submitBtn.textContent = editing ? "保存修改" : "收下这条";
        submitBtn.disabled = false;
      }
    }

    function showError(message) {
      errorLine.textContent = message || "";
      errorLine.classList.toggle("is-visible", !!message);
      if (message) {
        const first = singlePane.querySelector(".field");
        if (first) first.focus();
      }
    }

    urlInput.addEventListener("input", () => {
      updateSource();
      if (errorLine.classList.contains("is-visible")) showError("");
      clearTimeout(hintTimer);
      setUrlHint(URL_HINT_DEFAULT);
    });

    urlInput.addEventListener("paste", (event) => {
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      const raw =
        clipboard.getData("text/plain") || clipboard.getData("text") || "";
      if (!raw) return;
      const url = SZL.metadata.extractUrl(raw);
      if (!url) {
        event.preventDefault();
        setUrlHint("没有在这段文字里找到链接，请重新复制", "error");
        SZL.toast("没有识别到链接，请检查分享文字。", { type: "error" });
        return;
      }
      event.preventDefault();
      urlInput.value = url;
      showError("");
      updateSource();
      if (isNoisyText(raw)) {
        setUrlHint("已提取链接，其余分享文字已忽略", "ok");
      } else {
        setUrlHint(URL_HINT_DEFAULT);
      }
    });

    urlInput.addEventListener("blur", () => {
      const raw = urlInput.value.trim();
      if (!raw) return;
      const url = SZL.metadata.extractUrl(raw);
      if (!url || url === raw) return;
      const noisy = isNoisyText(raw);
      urlInput.value = url;
      updateSource();
      if (noisy) setUrlHint("已提取链接，其余分享文字已忽略", "ok");
    });

    urlInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        titleInput.focus();
      }
    });
    readBtn.addEventListener("click", async () => {
      const raw = urlInput.value.trim();
      const url = SZL.metadata.extractUrl(raw);
      if (!url) {
        SZL.toast("先粘贴一个链接。", { icon: "link" });
        urlInput.focus();
        return;
      }
      if (raw !== url) {
        urlInput.value = url;
        updateSource();
        if (isNoisyText(raw)) setUrlHint("已提取链接，其余分享文字已忽略", "ok");
      }
      readBtn.disabled = true;
      readBtn.textContent = "读取中…";
      try {
        const info = await SZL.metadata.lookup(url);
        if (info.title) {
          if (!titleInput.value.trim()) titleInput.value = info.title;
          if (!authorInput.value.trim() && info.author) authorInput.value = info.author;
          if (!coverInput.value.trim() && info.cover) coverInput.value = info.cover;
          SZL.toast("已读取页面信息。", { icon: "check" });
        } else {
          SZL.toast("这个平台没有开放页面信息，手动写一个标题就好。", { icon: "link" });
        }
        updateSource();
      } catch (err) {
        SZL.toast("读取失败，请手动填写。", { type: "error" });
      } finally {
        readBtn.disabled = false;
        readBtn.textContent = "自动读取";
      }
    });

    const parseBulk = util.debounce(() => {
      lastBulk = SZL.metadata.parseBulk(bulkInput.value);
      util.clear(bulkPreview);
      const existing = new Set(
        store
          .items()
          .map((item) => SZL.metadata.normalizeUrl(item.url))
          .filter(Boolean)
      );
      const fresh = lastBulk.items.filter((item) => !existing.has(item.url));
      const dupes = lastBulk.items.length - fresh.length + lastBulk.duplicates;
      bulkPreview.appendChild(
        util.el("span", { text: "可收下 " + fresh.length + " 条" })
      );
      if (dupes) bulkPreview.appendChild(util.el("span", { text: "跳过重复 " + dupes + " 条" }));
      if (lastBulk.invalid) {
        bulkPreview.appendChild(util.el("span", { text: "无法识别 " + lastBulk.invalid + " 行" }));
      }
      lastBulk.ready = fresh;
      updateSubmit();
    }, 180);

    bulkInput.addEventListener("input", parseBulk);

    singlePane.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    });
    bulkInput.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    });

    async function submit() {
      if (submitting) return;
      if (mode === "bulk" && !editing) {
        const existing = new Set(
          store
            .items()
            .map((item) => SZL.metadata.normalizeUrl(item.url))
            .filter(Boolean)
        );
        const parsed = SZL.metadata.parseBulk(bulkInput.value);
        const fresh = parsed.items.filter((item) => !existing.has(item.url));
        if (!fresh.length) {
          SZL.toast("没有可以新增的链接。", { type: "error" });
          return;
        }
        submitting = true;
        const created = store.addItems(
          fresh.map((entry) => ({
            title: entry.title || "待补充标题",
            url: entry.url,
            source: entry.source,
            cover: entry.cover || "",
            author: entry.author || "",
            summary: "",
            likedAt: entry.likedAt || new Date().toISOString(),
          }))
        );
        submitting = false;
        dlg.close();
        SZL.toast("已收下 " + created.length + " 条，标题和摘要都可以慢慢补。", {
          icon: "check",
        });
        app.navigate("feed");
        return;
      }

      const title = titleInput.value.trim();
      const rawUrl = urlInput.value.trim();
      const url = rawUrl ? SZL.metadata.extractUrl(rawUrl) : "";
      if (rawUrl && !url) {
        showError("没有识别到有效链接。可以直接粘贴整段分享文字，或检查一下链接。");
        urlInput.focus();
        return;
      }
      if (url && rawUrl !== url) {
        urlInput.value = url;
        updateSource();
        if (isNoisyText(rawUrl)) setUrlHint("已提取链接，其余分享文字已忽略", "ok");
      }
      if (!title) {
        showError("至少给它一个标题，哪怕先随便写一个。");
        titleInput.focus();
        return;
      }
      showError("");
      const source = model.detectSource(url || "https://example.com");
      const tags = model.normalizeTags(tagsInput.value);
      const likedAt = util.fromLocalInput(timeInput.value);
      const payload = {
        title,
        url,
        source: url ? source : "web",
        author: authorInput.value.trim(),
        summary: summaryInput.value.trim(),
        cover: coverInput.value.trim(),
        likedAt,
      };

      if (editing) {
        submitting = true;
        store.updateItem(editing.id, payload);
        store.setReview(editing.id, { tags });
        submitting = false;
        dlg.close();
        SZL.toast("已更新这条记录。", { icon: "check" });
        app.revealItem(editing.id, false);
        return;
      }

      if (url) {
        const duplicate = store
          .items()
          .find((item) => SZL.metadata.normalizeUrl(item.url) === url);
        if (duplicate) {
          dlg.close();
          SZL.toast("这条已经在回顾里了。", { icon: "link" });
          app.revealItem(duplicate.id, false);
          return;
        }
      }

      submitting = true;
      const created = store.addItem(Object.assign({}, payload, { review: { tags } }));
      submitting = false;
      dlg.close();
      SZL.toast("已收下《" + util.truncate(created.title, 22) + "》。", {
        icon: "check",
        action: {
          label: "写一句",
          onClick: () => app.revealItem(created.id, true),
        },
      });
      app.revealItem(created.id, false);
    }

    /* ---------------- prefill ---------------- */

    if (editing) {
      urlInput.value = editing.url || "";
      titleInput.value = editing.title || "";
      summaryInput.value = editing.summary || "";
      authorInput.value = editing.author || "";
      coverInput.value = editing.cover || "";
      tagsInput.value = (editing.review.tags || []).join(", ");
      timeInput.value = util.toLocalInput(editing.likedAt);
    } else {
      timeInput.value = util.toLocalInput(new Date());
      const draft = "";
      titleInput.value = draft;
    }
    updateSource();
    updateSubmit();
    setTimeout(() => {
      if (editing) titleInput.focus();
      else urlInput.focus();
    }, 80);

    return dlg;
  };
})();
