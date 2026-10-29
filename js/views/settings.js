/* ==========================================================================
   Settings — folder, appearance, data, about
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const util = SZL.util;
  const model = SZL.model;
  const views = (SZL.views = SZL.views || {});

  views.settings = function settingsView(ctx) {
    const store = ctx.store;
    const storage = SZL.app.storage;
    const root = util.el("div", { class: "page settings-page view-enter" });

    const head = util.el("header", { class: "page-head" });
    const eyebrow = util.el("div", {
      class: "eyebrow",
      text: "SETTINGS · 让它更像你的地方 · " + util.todayLabel(),
    });
    const headGrid = util.el("div", { class: "head-grid" });
    const title = util.el("h1", { class: "head-title" }, [
      util.el("span", { text: "设置" }),
      util.el("span", { class: "title-en", text: "settings" }),
    ]);
    headGrid.appendChild(title);
    headGrid.appendChild(
      util.el("div", { class: "head-side" }, [
        util.el("p", {
          class: "lede",
          text: "数据只属于你。它住在浏览器的本地数据库里，也可以随时搬进你选定的文件夹，分成一个个可读的 JSON 文件。",
        }),
        util.el("div", {
          class: "settings-meta",
          text: "LOCAL FIRST · NO ACCOUNT · NO CLOUD",
        }),
      ])
    );
    head.appendChild(eyebrow);
    head.appendChild(headGrid);

    const content = util.el("div", { class: "settings-layout" });
    root.appendChild(head);
    root.appendChild(content);
    root.appendChild(
      util.el("footer", { class: "page-foot" }, [
        util.el("span", {
          class: "philosophy",
          text: "数据是你的，注意力也是。",
        }),
        util.el("span", { class: "foot-mono", text: "SIZILIU · SETTINGS · v0.1" }),
      ])
    );

    const fileInput = util.el("input", {
      attrs: { type: "file", accept: ".json,application/json", hidden: "" },
    });
    root.appendChild(fileInput);
    fileInput.addEventListener("change", handleImportFile);

    /* ---------------- helpers ---------------- */

    function section(number, titleText, description, body) {
      const node = util.el("section", { class: "settings-section" });
      node.appendChild(
        util.el("div", { class: "settings-label", text: number + " / " + titleText })
      );
      const inner = util.el("div", { class: "settings-content" });
      inner.appendChild(util.el("h2", { class: "settings-title", text: titleText }));
      if (description) {
        inner.appendChild(util.el("p", { class: "settings-desc", text: description }));
      }
      inner.appendChild(body);
      node.appendChild(inner);
      return node;
    }

    function row(name, desc, control) {
      return util.el("div", { class: "setting-row" }, [
        util.el("div", { class: "setting-info" }, [
          util.el("div", { class: "setting-name", text: name }),
          desc ? util.el("div", { class: "setting-desc", text: desc }) : null,
        ]),
        util.el("div", { class: "setting-control" }, control),
      ]);
    }

    function segmented(options, value, onChange) {
      const wrap = util.el("div", { class: "segmented", attrs: { role: "group" } });
      options.forEach((option) => {
        wrap.appendChild(
          util.el("button", {
            class: "segmented-btn" + (option.value === value ? " is-on" : ""),
            attrs: { type: "button", "aria-pressed": String(option.value === value) },
            text: option.label,
            on: { click: () => onChange(option.value) },
          })
        );
      });
      return wrap;
    }

    function toggle(checked, onChange, label) {
      const btn = util.el("button", {
        class: "switch",
        attrs: {
          type: "button",
          role: "switch",
          "aria-checked": String(checked),
          "aria-label": label,
        },
        on: {
          click: () => {
            const next = btn.getAttribute("aria-checked") !== "true";
            btn.setAttribute("aria-checked", String(next));
            onChange(next);
          },
        },
      });
      return btn;
    }

    function folderStatus() {
      const ready = !!storage.folderReady;
      const hasHandle = !!storage.dirHandle;
      const dot = util.el("span", {
        class: "status-dot" + (ready ? " is-on" : " is-off"),
      });
      const text = ready
        ? "已连接 · " + (storage.folderName || "数据文件夹")
        : hasHandle
        ? "已选择「" + (storage.folderName || "数据文件夹") + "」，需要重新授权"
        : "未连接 · 目前保存在浏览器本地";
      return util.el("div", { class: "folder-status" }, [dot, util.el("span", { text })]);
    }

    function renderDataSection() {
      const wrap = util.el("div");
      const card = util.el("div", { class: "settings-card" });
      const folderAvailable = storage.supportsFolder && location.protocol !== "file:";
      const controls = util.el("div", { class: "setting-control" });
      if (folderAvailable) {
        if (storage.dirHandle && !storage.folderReady) {
          controls.appendChild(
            util.el("button", {
              class: "btn btn-primary btn-sm",
              attrs: { type: "button" },
              text: "重新授权",
              on: { click: reconnect },
            })
          );
        }
        controls.appendChild(
          util.el("button", {
            class: "btn btn-ghost btn-sm",
            attrs: { type: "button" },
            text: storage.dirHandle ? "更换文件夹" : "选择文件夹",
            on: { click: chooseFolder },
          })
        );
        if (storage.dirHandle && storage.folderReady) {
          controls.appendChild(
            util.el("button", {
              class: "btn btn-ghost btn-sm",
              attrs: { type: "button" },
              text: "写入一次",
              on: { click: writeNow },
            })
          );
        }
      } else {
        controls.appendChild(
          util.el("span", {
            class: "settings-note",
            text:
              location.protocol === "file:"
                ? "用「启动.cmd」以 localhost 打开后可连接"
                : "此浏览器不支持文件夹访问",
          })
        );
      }
      const statusRow = util.el("div", { class: "setting-row" }, [
        util.el("div", { class: "setting-info" }, [
          util.el("div", { class: "setting-name" }, [folderStatus()]),
          util.el("div", {
            class: "setting-desc",
            text: folderAvailable
              ? "连接后，每次修改都会自动写入 sizhiliu.json；你也可以随时手动写入。"
              : "数据仍会保存在浏览器的本地数据库里。若需要文件形式，请在桌面版 Chrome / Edge 中通过 localhost 打开，或使用下方的导出。",
          }),
        ]),
        controls,
      ]);
      card.appendChild(statusRow);

      if (folderAvailable) {
        card.appendChild(
          row(
            "自动写入数据文件夹",
            storage.folderReady
              ? "关闭后仍保存在浏览器里，需要你手动写入或导出。"
              : "连接文件夹后生效；当前仍会保存在浏览器本地。",
            toggle(
              !!store.settings().autoSaveFolder,
              (next) => {
                store.setSettings({ autoSaveFolder: next });
                SZL.app.saveIndicator("saved");
                if (next && storage.folderReady) writeNow(true);
              },
              "自动写入数据文件夹"
            )
          )
        );
      }

      if (storage.dirHandle && storage.folderReady) {
        card.appendChild(
          row(
            "断开文件夹",
            "不会删除文件夹里的文件，只是不再自动写入。",
            util.el("button", {
              class: "btn btn-quiet btn-sm",
              attrs: { type: "button" },
              text: "断开",
              on: { click: disconnect },
            })
          )
        );
      }

      wrap.appendChild(card);
      wrap.appendChild(
        util.el("p", {
          class: "settings-note",
          html:
            "文件名固定为 <code>sizhiliu.json</code>，内容是可读的 JSON，包含所有内容、评价、标签与设置，随时可以复制、备份或迁移。",
        })
      );
      return wrap;
    }

    function renderAppearance() {
      const card = util.el("div", { class: "settings-card" });
      card.appendChild(
        row(
          "主题",
          "暖纸色适合白天，墨色适合夜里。",
          segmented(
            [
              { label: "浅色", value: "light" },
              { label: "深色", value: "dark" },
            ],
            store.settings().theme,
            (value) => {
              store.setSettings({ theme: value });
              refresh();
            }
          )
        )
      );
      card.appendChild(
        row(
          "卡片密度",
          "舒朗适合慢慢看，紧凑适合快速扫过。",
          segmented(
            [
              { label: "舒朗", value: "comfy" },
              { label: "紧凑", value: "compact" },
            ],
            store.settings().density,
            (value) => {
              store.setSettings({ density: value });
              refresh();
            }
          )
        )
      );
      card.appendChild(
        row(
          "界面动效",
          "关闭后，页面切换与标签浮动会更安静。",
          toggle(
            store.settings().motion !== false,
            (next) => {
              store.setSettings({ motion: next });
              refresh();
            },
            "界面动效"
          )
        )
      );
      return card;
    }

    function renderDataManage() {
      const wrap = util.el("div");
      const card = util.el("div", { class: "settings-card" });
      card.appendChild(
        row(
          "导出备份",
          "下载一份完整 JSON，可以带到别的浏览器或留作存档。",
          util.el("button", {
            class: "btn btn-ghost btn-sm",
            attrs: { type: "button" },
            html: util.icon("download", 13) + "<span>导出</span>",
            on: { click: exportData },
          })
        )
      );
      card.appendChild(
        row(
          "导入备份",
          "从 JSON 文件恢复，可选择合并或替换当前内容。",
          util.el("button", {
            class: "btn btn-ghost btn-sm",
            attrs: { type: "button" },
            html: util.icon("upload", 13) + "<span>导入</span>",
            on: { click: () => fileInput.click() },
          })
        )
      );
      card.appendChild(
        row(
          "载入示例",
          "重新放回 16 条示例内容，方便演示或熟悉功能。",
          util.el("button", {
            class: "btn btn-quiet btn-sm",
            attrs: { type: "button" },
            text: "载入",
            on: { click: resetDemo },
          })
        )
      );
      card.appendChild(
        row(
          "清空全部",
          "删除这台设备上的所有内容与评价。建议先导出备份。",
          util.el("button", {
            class: "btn btn-danger btn-sm",
            attrs: { type: "button" },
            text: "清空",
            on: { click: clearAll },
          })
        )
      );
      wrap.appendChild(card);

      const stats = store.stats();
      const statLine = util.el("div", { class: "settings-stats" });
      [
        ["内容", stats.total],
        ["感想", stats.notes],
        ["标签路径", stats.tags],
        ["待回看", stats.pending],
      ].forEach(([label, value]) => {
        statLine.appendChild(
          util.el("div", { class: "settings-stat" }, [
            util.el("span", { class: "settings-stat-num", text: String(value) }),
            util.el("span", { class: "settings-stat-label", text: label }),
          ])
        );
      });
      wrap.appendChild(statLine);
      return wrap;
    }

    function renderCaptureHelp() {
      const wrap = util.el("div");
      const card = util.el("div", { class: "settings-card settings-help" });
      const steps = util.el("ol", { class: "help-steps" });
      [
        ["收下一条", "粘贴任意平台的链接，补上标题与一句摘要。来源会自动识别。"],
        ["批量粘贴", "从点赞列表里一行复制一条链接，或在“收下一条”里选择批量标签页。"],
        ["浏览器采集器", "把下面的按钮拖进书签栏，在 B站 / 小红书 / 知乎的收藏页点一下，抓取当前页内容，再回来批量粘贴。"],
      ].forEach(([name, desc], i) => {
        steps.appendChild(
          util.el("li", { class: "help-step" }, [
            util.el("span", { class: "help-step-num", text: "0" + (i + 1) }),
            util.el("div", {}, [
              util.el("div", { class: "help-step-name", text: name }),
              util.el("div", { class: "help-step-desc", text: desc }),
            ]),
          ])
        );
      });
      card.appendChild(steps);
      const tools = util.el("div", { class: "settings-toolbar" }, [
        util.el("button", {
          class: "btn btn-primary btn-sm",
          attrs: { type: "button" },
          html: util.icon("plus", 13) + "<span>收下一条</span>",
          on: { click: () => ctx.app.openCapture() },
        }),
        util.el(
          "a",
          {
            class: "bookmarklet",
            attrs: {
              href: SZL.metadata.bookmarklet(location.href),
              title: "拖动我到书签栏",
              draggable: "true",
            },
            on: {
              click: (event) => {
                event.preventDefault();
                SZL.toast("请把这个按钮拖到书签栏，而不要直接点击。", { icon: "link" });
              },
            },
          },
          "思之流采集器"
        ),
        util.el("span", {
          class: "settings-toolbar-hint",
          text: "实验性：只在当前页面内读取可见链接，不会上传数据。",
        }),
      ]);
      card.appendChild(tools);
      wrap.appendChild(card);
      return wrap;
    }

    function renderAbout() {
      const wrap = util.el("div");
      const quote = util.el("blockquote", { class: "about-quote" }, [
        util.el("p", {
          text:
            "通过不断地评价、回顾、思考，打断被信息流劫持的大脑，更容易看清自己，而不是被 BGM 推着大脑走。",
        }),
        util.el("cite", { text: "—— 思之流 · 产品哲学" }),
      ]);
      wrap.appendChild(quote);
      const card = util.el("div", { class: "settings-card" });
      card.appendChild(
        row(
          "快捷键",
          "⌘K / Ctrl K 打开检索与跳转；/ 聚焦搜索；Esc 关闭浮层。",
          util.el("kbd", { text: util.modKey() + " K" })
        )
      );
      card.appendChild(
        row(
          "隐私",
          "没有账号，没有云端，没有统计。所有内容只在你选择的本地文件夹与浏览器里。",
          util.el("span", {
            class: "about-tag",
            text: "LOCAL ONLY",
          })
        )
      );
      card.appendChild(
        row(
          "版本",
          "思之流 v0.1 · 一个本地优先的回顾空间。",
          util.el("span", { class: "about-version", text: "0.1.0" })
        )
      );
      wrap.appendChild(card);
      return wrap;
    }

    /* ---------------- actions ---------------- */

    async function chooseFolder() {
      try {
        const handle = await storage.chooseFolder();
        let existing = null;
        try {
          existing = await storage.readFolderState();
        } catch (err) {
          existing = null;
        }
        if (existing && existing.items.length) {
          const choice = await new Promise((resolve) => {
            const dlg = SZL.ui.dialog({
              eyebrow: "数据文件夹",
              title: "这个文件夹里已有记录",
              subtitle:
                "找到 " +
                existing.items.length +
                " 条记录。你可以载入它，或用当前数据覆盖这个文件。",
              width: "480px",
              content: util.el("p", {
                class: "form-note",
                text: "两种操作都会写入 sizhiliu.json，差别是哪一个版本作为之后的基础。",
              }),
              footer: [
                util.el("button", {
                  class: "btn btn-ghost",
                  attrs: { type: "button" },
                  text: "取消连接",
                  on: {
                    click: () => {
                      dlg.close();
                      resolve("cancel");
                    },
                  },
                }),
                util.el("button", {
                  class: "btn btn-ghost",
                  attrs: { type: "button" },
                  text: "用当前数据覆盖",
                  on: {
                    click: () => {
                      dlg.close();
                      resolve("overwrite");
                    },
                  },
                }),
                util.el("button", {
                  class: "btn btn-primary",
                  attrs: { type: "button" },
                  text: "载入文件夹版本",
                  on: {
                    click: () => {
                      dlg.close();
                      resolve("load");
                    },
                  },
                }),
              ],
              onClose: () => resolve("cancel"),
            });
          });
          if (choice === "cancel") {
            await storage.disconnectFolder();
            refresh();
            return;
          }
          if (choice === "load") {
            store.importState(existing, "replace");
            SZL.toast("已载入文件夹中的记录。", { icon: "folder" });
          } else {
            await storage.saveToFolder(store.state);
            SZL.toast("已用当前数据覆盖文件夹。", { icon: "folder" });
          }
        } else {
          await storage.saveToFolder(store.state);
          SZL.toast("已连接「" + handle.name + "」，数据会自动写入。", { icon: "folder" });
        }
        store.setSettings({ folderName: handle.name || "" });
        SZL.app.saveIndicator("saved");
        refresh();
      } catch (err) {
        if (err && err.name === "AbortError") return;
        if (err && err.name === "SecurityError") {
          SZL.toast("浏览器阻止了文件夹访问，请确认页面在 localhost 或 https 下打开。", {
            type: "error",
          });
          return;
        }
        SZL.toast("无法连接文件夹：" + (err.message || err), { type: "error" });
      }
    }

    async function reconnect() {
      const ok = await storage.reconnectFolder();
      if (ok) {
        SZL.toast("已重新连接数据文件夹。", { icon: "folder" });
        SZL.app.saveIndicator("saved");
        refresh();
      } else {
        SZL.toast("授权未完成。", { type: "error" });
      }
    }

    async function writeNow(silent) {
      try {
        await storage.saveToFolder(store.state);
        SZL.app.saveIndicator("saved");
        if (!silent) SZL.toast("已写入 sizhiliu.json。", { icon: "folder" });
      } catch (err) {
        SZL.toast("写入失败：" + (err.message || err), { type: "error" });
      }
    }

    async function disconnect() {
      const ok = await SZL.ui.confirm({
        eyebrow: "数据文件夹",
        title: "断开这个文件夹？",
        message: "文件不会被删除，只是不再自动写入。你仍然可以导出 JSON。",
        confirmText: "断开",
        cancelText: "保留",
      });
      if (!ok) return;
      await storage.disconnectFolder();
      store.setSettings({ folderName: "" });
      refresh();
      SZL.toast("已断开数据文件夹。");
    }

    function exportData() {
      storage.exportState(store.state);
      SZL.toast("已导出 JSON 备份。", { icon: "download" });
    }

    async function handleImportFile(event) {
      const file = event.target.files && event.target.files[0];
      event.target.value = "";
      if (!file) return;
      try {
        const text = await util.readFileText(file);
        const parsed = JSON.parse(text);
        const normalized = model.normalizeState(parsed);
        if (!normalized) throw new Error("文件里没有可识别的思之流数据。");
        const count = normalized.items.length;
        const choice = await new Promise((resolve) => {
          const dlg = SZL.ui.dialog({
            eyebrow: "导入备份",
            title: "导入 " + count + " 条记录",
            subtitle: "选择如何与当前的 " + store.items().length + " 条记录相处。",
            width: "500px",
            content: util.el("p", {
              class: "form-note",
              text: "合并会保留两边不同的记录；替换会用文件内容覆盖当前全部内容。",
            }),
            footer: [
              util.el("button", {
                class: "btn btn-ghost",
                attrs: { type: "button" },
                text: "取消",
                on: { click: () => { dlg.close(); resolve("cancel"); } },
              }),
              util.el("button", {
                class: "btn btn-ghost",
                attrs: { type: "button" },
                text: "合并",
                on: { click: () => { dlg.close(); resolve("merge"); } },
              }),
              util.el("button", {
                class: "btn btn-primary",
                attrs: { type: "button" },
                text: "替换全部",
                on: { click: () => { dlg.close(); resolve("replace"); } },
              }),
            ],
            onClose: () => resolve("cancel"),
          });
        });
        if (choice === "cancel") return;
        const result = store.importState(parsed, choice);
        SZL.toast(
          choice === "merge" ? "已合并 " + result + " 条新记录。" : "已导入 " + result + " 条记录。",
          { icon: "check" }
        );
        ctx.app.navigate("feed");
      } catch (err) {
        SZL.toast("导入失败：" + (err.message || err), { type: "error" });
      }
    }

    async function resetDemo() {
      const ok = await SZL.ui.confirm({
        eyebrow: "示例数据",
        title: "重新载入示例内容？",
        message: "当前的 " + store.items().length + " 条记录会被示例替换。建议先导出备份。",
        confirmText: "载入示例",
        cancelText: "取消",
        danger: true,
      });
      if (!ok) return;
      store.resetDemo();
      SZL.toast("已载入 16 条示例。", { icon: "spark" });
      ctx.app.navigate("feed");
    }

    async function clearAll() {
      const ok = await SZL.ui.confirm({
        eyebrow: "清空全部",
        title: "确定清空所有内容？",
        message:
          "这台设备上的 " +
          store.items().length +
          " 条内容、所有评价与标签会被删除。此操作不可撤销，建议先导出备份。",
        confirmText: "全部清空",
        cancelText: "取消",
        danger: true,
      });
      if (!ok) return;
      store.clearAll();
      SZL.toast("已清空。可以从一条内容重新开始。", { icon: "trash" });
      ctx.app.navigate("feed");
    }

    /* ---------------- render ---------------- */

    function refresh() {
      util.clear(content);
      content.appendChild(
        section(
          "01",
          "数据",
          "默认存在浏览器的本地数据库里。连接一个文件夹后，每次修改都会同步写成一份可读的 JSON，搬家、备份、换电脑都更容易。",
          renderDataSection()
        )
      );
      content.appendChild(
        section(
          "02",
          "外观",
          "这里没有信息流，只有你愿意留下的东西。调整成看着舒服的样子就好。",
          renderAppearance()
        )
      );
      content.appendChild(
        section(
          "03",
          "数据管理",
          "把记录带走，或者把别处的记录带回来。导出的文件包含全部内容，不含任何账号信息。",
          renderDataManage()
        )
      );
      content.appendChild(
        section(
          "04",
          "怎么收下内容",
          "网页无法直接读取你在各家 App 里的点赞记录，但可以很快地把它们变成可以回顾的条目。",
          renderCaptureHelp()
        )
      );
      content.appendChild(
        section("05", "关于", null, renderAbout())
      );
    }

    refresh();

    const off = store.on("change", (payload) => {
      if (payload.reason === "settings") {
        // controls update themselves; refresh only if folder display changed
      }
    });

    return {
      el: root,
      destroy() {
        off();
      },
    };
  };
})();
