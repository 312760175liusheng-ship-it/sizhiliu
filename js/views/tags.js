/* ==========================================================================
   Tags: floating constellation + notes under a tag
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const util = SZL.util;
  const model = SZL.model;
  const views = (SZL.views = SZL.views || {});

  const PAD = 34;
  const TOP_PAD = 96;

  function mergeRects(a, b, padding) {
    const p = padding || 6;
    return !(
      a.x + a.w + p < b.x ||
      b.x + b.w + p < a.x ||
      a.y + a.h + p < b.y ||
      b.y + b.h + p < a.y
    );
  }

  views.tags = function tagsView(ctx) {
    const store = ctx.store;
    const root = util.el("div", { class: "page tags-page view-enter" });
    let tree = store.tags();
    let selected = ctx.app.tagSelection || "";
    let cloudTags = [];
    let frameId = 0;
    let lastFrame = 0;
    let destroyed = false;
    let resizeTimer = null;

    /* ---------------- header ---------------- */

    const head = util.el("header", { class: "page-head" });
    const eyebrow = util.el("div", {
      class: "eyebrow",
      text: "TAGS · 想法的坐标 · " + util.todayLabel(),
    });
    const headGrid = util.el("div", { class: "head-grid" });
    const title = util.el("h1", { class: "head-title" }, [
      util.el("span", { text: "标签" }),
      util.el("span", { class: "title-en", text: "tags" }),
      util.el("span", { class: "title-count", text: "" }),
    ]);
    const titleCount = title.querySelector(".title-count");
    headGrid.appendChild(title);
    headGrid.appendChild(
      util.el("div", { class: "head-side" }, [
        util.el("p", {
          class: "lede",
          text: "标签不是盒子，是想法之间的暗线。让它们悬浮一会儿，点开任意一条，看看自己反复被什么吸引。",
        }),
        util.el("div", {
          class: "tag-legend",
          html:
            '<span class="legend-item"><span class="legend-dot legend-dot-lg"></span>出现越多，字越大</span>' +
            '<span class="legend-item"><span class="legend-line"></span>父标签 / 子标签</span>',
        }),
      ])
    );
    head.appendChild(eyebrow);
    head.appendChild(headGrid);

    /* ---------------- cloud ---------------- */

    const cloudShell = util.el("section", {
      class: "tag-cloud-shell",
      attrs: { "aria-label": "标签云" },
    });
    const cloud = util.el("div", { class: "tag-cloud" });
    const cloudCaption = util.el("div", { class: "cloud-caption" }, [
      util.el("span", { class: "cloud-caption-main", text: "TAG CONSTELLATION" }),
      util.el("span", { class: "cloud-caption-sub", text: "点击任意标签，查看与它相连的感想" }),
    ]);
    const cloudCount = util.el("span", { class: "cloud-count", text: "" });
    const lineSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    lineSvg.setAttribute("class", "cloud-lines");
    lineSvg.setAttribute("aria-hidden", "true");
    cloud.appendChild(lineSvg);
    cloud.appendChild(cloudCaption);
    cloud.appendChild(cloudCount);
    cloud.appendChild(
      util.el("div", { class: "cloud-center", attrs: { "aria-hidden": "true" } }, [
        util.el("span", { class: "cloud-center-dot" }),
        util.el("span", { class: "cloud-center-text", text: "ORIGIN" }),
      ])
    );
    cloudShell.appendChild(cloud);
    let lineEls = [];

    const detailHost = util.el("div", { class: "tag-detail-host" });
    const index = util.el("section", { class: "tag-index" });

    const footer = util.el("footer", { class: "page-foot" }, [
      util.el("span", {
        class: "philosophy",
        text: "一条推文会消失，一个标签会留下来。",
      }),
      util.el("span", { class: "foot-mono", text: "TAGS · " + tree.list.length + " PATHS" }),
    ]);

    root.appendChild(head);
    root.appendChild(cloudShell);
    root.appendChild(detailHost);
    root.appendChild(index);
    root.appendChild(footer);

    /* ---------------- cloud build ---------------- */

    function createCloudTag(node, i) {
      const fontSize = 14 + Math.min(node.total, 7) * 2.8 + (node.depth === 1 ? 1.5 : 0);
      const tag = util.el("button", {
        class: "cloud-tag",
        attrs: {
          type: "button",
          "aria-pressed": String(selected === node.path),
          title:
            node.path +
            " · " +
            node.total +
            " 条感想" +
            (node.children.length ? " · " + node.children.length + " 个子标签" : ""),
        },
        style: { "--fs": fontSize.toFixed(1) + "px" },
        on: {
          click: () => selectTag(node.path),
          mouseenter: () => {
            tag._hovered = true;
            tag.classList.add("is-hovered");
            tag.style.zIndex = "8";
          },
          mouseleave: () => {
            tag._hovered = false;
            tag.classList.remove("is-hovered");
            tag.style.zIndex = "";
          },
          focus: () => {
            tag._hovered = true;
          },
          blur: () => {
            tag._hovered = false;
          },
        },
      });
      tag.appendChild(util.el("span", { class: "ct-name", text: node.name }));
      tag.appendChild(util.el("span", { class: "ct-count", text: String(node.total) }));
      if (node.children.length) {
        tag.appendChild(
          util.el("span", {
            class: "ct-kids",
            text: "+" + node.children.length,
            attrs: { title: node.children.map((c) => c.name).join(" / ") },
          })
        );
      }
      tag.dataset.path = node.path;
      tag._node = node;
      tag._seed = util.hash(node.path);
      tag.classList.toggle("is-selected", isAncestorSelected(node.path));
      return tag;
    }

    function isAncestorSelected(path) {
      if (!selected) return false;
      return selected === path || selected.startsWith(path + "/");
    }

    function layoutCloud(resetPositions) {
      const width = cloud.clientWidth;
      const height = cloud.clientHeight;
      const count = cloudTags.length || 1;
      const golden = Math.PI * (3 - Math.sqrt(5));
      const usableH = Math.max(120, height - TOP_PAD - PAD);

      cloudTags.forEach((tag, i) => {
        const w = tag.offsetWidth;
        const h = tag.offsetHeight;
        const maxX = Math.max(PAD, width - w - PAD);
        const maxY = Math.max(TOP_PAD, height - h - PAD);
        if (resetPositions || tag._x == null) {
          const tagRand = util.mulberry32(tag._seed);
          const angle = i * golden + (tagRand() - 0.5) * 0.55;
          const r = Math.sqrt((i + 0.9) / (count + 0.9));
          const radiusX = Math.max(0, width / 2 - PAD - w / 2) * (0.34 + 0.66 * r);
          const radiusY = Math.max(0, usableH / 2 - h / 2) * (0.34 + 0.66 * r);
          const baseX = width / 2 + Math.cos(angle) * radiusX - w / 2;
          const baseY =
            TOP_PAD + usableH / 2 + Math.sin(angle) * radiusY - h / 2;
          tag._x = util.clamp(baseX, PAD, maxX);
          tag._y = util.clamp(baseY, TOP_PAD, maxY);
          tag._vx = (tagRand() - 0.5) * 7;
          tag._vy = (tagRand() - 0.5) * 7;
        } else {
          tag._x = util.clamp(tag._x, PAD, maxX);
          tag._y = util.clamp(tag._y, TOP_PAD, maxY);
        }
      });
      relax(110);
      paint();
    }

    function relax(iterations) {
      const width = cloud.clientWidth;
      const height = cloud.clientHeight;
      for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < cloudTags.length; i++) {
          const a = cloudTags[i];
          for (let j = i + 1; j < cloudTags.length; j++) {
            const b = cloudTags[j];
            const ra = { x: a._x, y: a._y, w: a.offsetWidth, h: a.offsetHeight };
            const rb = { x: b._x, y: b._y, w: b.offsetWidth, h: b.offsetHeight };
            if (!mergeRects(ra, rb, 10)) continue;
            const acx = a._x + a.offsetWidth / 2;
            const acy = a._y + a.offsetHeight / 2;
            const bcx = b._x + b.offsetWidth / 2;
            const bcy = b._y + b.offsetHeight / 2;
            let dx = acx - bcx;
            let dy = acy - bcy;
            if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
              dx = 1;
              dy = 1;
            }
            const overlapX =
              (a.offsetWidth + b.offsetWidth) / 2 + 10 - Math.abs(dx);
            const overlapY =
              (a.offsetHeight + b.offsetHeight) / 2 + 10 - Math.abs(dy);
            if (overlapX <= 0 || overlapY <= 0) continue;
            if (overlapX < overlapY) {
              a._x += (Math.sign(dx) || 1) * overlapX * 0.5;
              b._x -= (Math.sign(dx) || 1) * overlapX * 0.5;
            } else {
              a._y += (Math.sign(dy) || 1) * overlapY * 0.5;
              b._y -= (Math.sign(dy) || 1) * overlapY * 0.5;
            }
          }
        }
        cloudTags.forEach((tag) => {
          const maxX = Math.max(PAD, width - tag.offsetWidth - PAD);
          const maxY = Math.max(TOP_PAD, height - tag.offsetHeight - PAD);
          tag._x = util.clamp(tag._x, PAD, maxX);
          tag._y = util.clamp(tag._y, TOP_PAD, maxY);
        });
      }
    }

    function paint() {
      cloudTags.forEach((tag) => {
        tag.style.setProperty("--x", tag._x.toFixed(1) + "px");
        tag.style.setProperty("--y", tag._y.toFixed(1) + "px");
      });
      updateLines();
    }

    function updateLines() {
      if (!lineEls.length || !cloudTags.length) return;
      const centers = cloudTags.map((tag) => ({
        x: tag._x + tag.offsetWidth / 2,
        y: tag._y + tag.offsetHeight / 2,
        path: tag.dataset.path,
      }));
      const pairs = new Map();
      centers.forEach((a, i) => {
        const distances = [];
        centers.forEach((b, j) => {
          if (i === j) return;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 360) distances.push({ j, d, center: b });
        });
        distances.sort((m, n) => m.d - n.d);
        distances.slice(0, 2).forEach(({ j, center }) => {
          const key = i < j ? i + ":" + j : j + ":" + i;
          if (!pairs.has(key)) {
            pairs.set(key, {
              a,
              b: center,
              d: Math.hypot(a.x - center.x, a.y - center.y),
            });
          }
        });
      });
      const list = Array.from(pairs.values()).slice(0, lineEls.length);
      const selectedTop = selected ? selected.split("/")[0] : "";
      lineEls.forEach((line, index) => {
        const pair = list[index];
        if (!pair) {
          line.style.display = "none";
          return;
        }
        line.style.display = "";
        line.setAttribute("x1", pair.a.x.toFixed(1));
        line.setAttribute("y1", pair.a.y.toFixed(1));
        line.setAttribute("x2", pair.b.x.toFixed(1));
        line.setAttribute("y2", pair.b.y.toFixed(1));
        line.style.opacity = (0.16 + (1 - Math.min(pair.d, 360) / 360) * 0.3).toFixed(3);
        const hot =
          !!selectedTop && (pair.a.path === selectedTop || pair.b.path === selectedTop);
        line.classList.toggle("is-hot", hot);
        line.style.stroke = hot ? "var(--accent)" : "";
      });
    }

    function animate(now) {
      if (destroyed) return;
      if (!lastFrame) lastFrame = now;
      const dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;
      const width = cloud.clientWidth;
      const height = cloud.clientHeight;

      if (!util.prefersReducedMotion()) {
        cloudTags.forEach((tag) => {
          if (!tag._hovered) {
            tag._x += tag._vx * dt;
            tag._y += tag._vy * dt;
          }
          const w = tag.offsetWidth;
          const h = tag.offsetHeight;
          const maxX = Math.max(PAD, width - w - PAD);
          const maxY = Math.max(TOP_PAD, height - h - PAD);
          if (tag._x < PAD) {
            tag._x = PAD;
            tag._vx = Math.abs(tag._vx) || 2;
          }
          if (tag._x > maxX) {
            tag._x = maxX;
            tag._vx = -Math.abs(tag._vx) || -2;
          }
          if (tag._y < TOP_PAD) {
            tag._y = TOP_PAD;
            tag._vy = Math.abs(tag._vy) || 2;
          }
          if (tag._y > maxY) {
            tag._y = maxY;
            tag._vy = -Math.abs(tag._vy) || -2;
          }
        });

        for (let i = 0; i < cloudTags.length; i++) {
          const a = cloudTags[i];
          for (let j = i + 1; j < cloudTags.length; j++) {
            const b = cloudTags[j];
            const dx =
              a._x + a.offsetWidth / 2 - (b._x + b.offsetWidth / 2);
            const dy =
              a._y + a.offsetHeight / 2 - (b._y + b.offsetHeight / 2);
            const overlapX =
              (a.offsetWidth + b.offsetWidth) / 2 + 12 - Math.abs(dx);
            const overlapY =
              (a.offsetHeight + b.offsetHeight) / 2 + 12 - Math.abs(dy);
            if (overlapX <= 0 || overlapY <= 0) continue;
            const push = Math.min(overlapX, overlapY) * 0.6;
            if (overlapX < overlapY) {
              const sx = Math.sign(dx) || 1;
              a._x += sx * push;
              b._x -= sx * push;
              a._vx += sx * 1.4;
              b._vx -= sx * 1.4;
            } else {
              const sy = Math.sign(dy) || 1;
              a._y += sy * push;
              b._y -= sy * push;
              a._vy += sy * 1.4;
              b._vy -= sy * 1.4;
            }
          }
        }
        cloudTags.forEach((tag) => {
          tag._vx = util.clamp(tag._vx * 0.998, -10, 10);
          tag._vy = util.clamp(tag._vy * 0.998, -10, 10);
        });
      }

      paint();
      frameId = requestAnimationFrame(animate);
    }

    function buildCloud() {
      cloud.querySelectorAll(".cloud-tag").forEach((node) => node.remove());
      cloud.querySelectorAll(".cloud-empty").forEach((node) => node.remove());
      lineSvg.textContent = "";
      lineEls = [];
      tree = store.tags();
      if (selected && !tree.nodes.has(selected)) {
        selected = "";
        ctx.app.tagSelection = "";
      }
      cloudTags = tree.top.map(createCloudTag);
      if (!cloudTags.length) {
        cloud.appendChild(emptyCloud());
        cloudCount.textContent = "";
        if (frameId) cancelAnimationFrame(frameId);
        frameId = 0;
        return;
      }
      cloudTags.forEach((tag) => cloud.appendChild(tag));
      cloudTags.forEach(() => {
        for (let k = 0; k < 2; k++) {
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("class", "cloud-line");
          lineSvg.appendChild(line);
          lineEls.push(line);
        }
      });
      cloudCount.textContent =
        tree.top.length + " TAGS / " + tree.list.length + " PATHS";
      layoutCloud(true);
      if (!frameId && mounted) frameId = requestAnimationFrame(animate);
    }

    function emptyCloud() {
      const node = util.el("div", { class: "cloud-empty" });
      node.appendChild(util.el("div", { class: "cloud-empty-mark", html: util.icon("leaf", 28) }));
      node.appendChild(util.el("p", { text: "还没有标签。写下第一条带标签的感想，这里会慢慢亮起来。" }));
      node.appendChild(
        util.el("button", {
          class: "btn btn-ghost btn-sm",
          attrs: { type: "button" },
          text: "去回看里写一条",
          on: { click: () => ctx.app.navigate("feed") },
        })
      );
      return node;
    }

    /* ---------------- detail ---------------- */

    function selectTag(path) {
      selected = path || "";
      ctx.app.tagSelection = selected;
      cloudTags.forEach((tag) => {
        const active = selected
          ? selected === tag.dataset.path || selected.startsWith(tag.dataset.path + "/")
          : false;
        tag.classList.toggle("is-selected", active);
        tag.setAttribute("aria-pressed", String(active));
      });
      updateLines();
      renderDetail();
      renderIndex();
      if (selected) {
        requestAnimationFrame(() => {
          const rect = detailHost.getBoundingClientRect();
          if (rect.top > window.innerHeight - 180) {
            detailHost.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      }
    }

    function renderDetail() {
      util.clear(detailHost);
      if (!selected) return;
      const node = tree.nodes.get(selected);
      if (!node) return;
      const notes = SZL.search.tagNotes(store.items(), selected);
      const section = util.el("section", { class: "tag-detail" });

      const headRow = util.el("div", { class: "tag-detail-head" });
      headRow.appendChild(util.el("span", { class: "tag-symbol", text: "#" }));
      headRow.appendChild(
        util.el("h2", {
          class: "tag-detail-title",
          text: node.path.split("/").join(" / "),
        })
      );
      const count = util.el("span", {
        class: "tag-detail-meta",
        text: notes.length + " 条感想 · 共 " + node.total + " 条内容",
      });
      headRow.appendChild(count);
      headRow.appendChild(
        util.el("button", {
          class: "tag-clear tag-back",
          attrs: { type: "button" },
          text: "↑ 标签云",
          on: {
            click: () => {
              cloudShell.scrollIntoView({ behavior: "smooth", block: "start" });
            },
          },
        })
      );
      headRow.appendChild(
        util.el("button", {
          class: "tag-clear",
          attrs: { type: "button", "aria-label": "取消选择标签" },
          text: "清除选择",
          on: { click: () => selectTag("") },
        })
      );
      section.appendChild(headRow);

      if (node.children.length) {
        const kids = util.el("div", { class: "tag-children" });
        kids.appendChild(util.el("span", { class: "detail-label", text: "子标签" }));
        node.children.forEach((child) => {
          kids.appendChild(
            util.el(
              "button",
              {
                class: "chip",
                attrs: { type: "button" },
                on: { click: () => selectTag(child.path) },
              },
              [
                util.el("span", { text: child.name }),
                util.el("span", { class: "chip-count", text: String(child.total) }),
              ]
            )
          );
        });
        section.appendChild(kids);
      }

      if (!notes.length) {
        section.appendChild(
          util.el("div", { class: "tag-detail-empty" }, [
            util.el("p", { text: "这个标签下还没有写下感想。" }),
            util.el("button", {
              class: "btn btn-ghost btn-sm",
              attrs: { type: "button" },
              text: "回到回看，补一句",
              on: { click: () => ctx.app.navigate("feed") },
            }),
          ])
        );
      } else {
        const grid = util.el("div", { class: "note-grid" });
        notes.forEach((item, i) => {
          const card = util.el("article", { class: "note-card" });
          card.style.animationDelay = Math.min(i * 50, 300) + "ms";
          const top = util.el("div", { class: "note-card-top" }, [
            util.el("span", {
              class: "note-date",
              text: util.formatShortDate(item.review.reviewedAt || item.likedAt),
            }),
          ]);
          const rating = util.el("span", {
            class: "rating",
            attrs: { "aria-label": "评分 " + (item.review.rating || 0) + " / 5" },
          });
          for (let d = 1; d <= 5; d++) {
            rating.appendChild(
              util.el("span", { class: "rating-dot" + (d <= item.review.rating ? " is-on" : "") })
            );
          }
          top.appendChild(rating);
          card.appendChild(top);
          card.appendChild(util.el("blockquote", { class: "note-quote", text: item.review.note }));
          const foot = util.el("div", { class: "note-card-foot" });
          const link = util.el("button", {
            class: "note-link",
            attrs: { type: "button", title: "在回看中展开这条" },
            on: { click: () => ctx.app.openItem(item.id) },
          }, [
            util.el("span", { class: "note-link-src", text: model.sourceMeta(item.source).label }),
            util.el("span", { class: "note-link-title", text: "《" + item.title + "》" }),
          ]);
          foot.appendChild(link);
          foot.appendChild(util.el("span", { class: "note-arrow", html: util.icon("arrowRight", 12) }));
          card.appendChild(foot);
          grid.appendChild(card);
        });
        section.appendChild(grid);
      }
      detailHost.appendChild(section);
    }

    /* ---------------- index ---------------- */

    function renderIndex() {
      util.clear(index);
      const headRow = util.el("div", { class: "tag-index-head" });
      headRow.appendChild(util.el("span", { class: "detail-label", text: "全部标签" }));
      headRow.appendChild(
        util.el("span", { class: "tag-index-meta", text: tree.list.length + " 条路径" })
      );
      index.appendChild(headRow);
      const list = util.el("div", { class: "tag-index-list" });
      const sorted = tree.list.slice().sort((a, b) => a.path.localeCompare(b.path, "zh"));
      sorted.forEach((node) => {
        const btn = util.el(
          "button",
          {
            class: "index-tag" + (node.depth > 1 ? " is-child" : ""),
            attrs: { type: "button" },
            on: { click: () => selectTag(node.path) },
          },
          [
            node.depth > 1
              ? util.el("span", { class: "index-parent", text: model.tagParent(node.path) + " / " })
              : null,
            util.el("span", { text: node.name }),
            util.el("span", { class: "index-count", text: String(node.total) }),
          ]
        );
        btn.classList.toggle("is-active", selected === node.path);
        list.appendChild(btn);
      });
      index.appendChild(list);
    }

    /* ---------------- boot ---------------- */

    let mounted = false;
    let ro = null;

    function mount() {
      if (mounted) return;
      mounted = true;
      titleCount.textContent = String(tree.top.length).padStart(2, "0");
      buildCloud();
      renderDetail();
      renderIndex();
      if ("ResizeObserver" in window) {
        ro = new ResizeObserver(
          util.debounce(() => {
            if (destroyed || !cloudTags.length) return;
            layoutCloud(false);
          }, 140)
        );
        ro.observe(cloud);
      }
      if (!frameId && cloudTags.length) {
        lastFrame = 0;
        frameId = requestAnimationFrame(animate);
      }
    }

    function onStoreChange(payload) {
      if (!mounted) return;
      if (CLUSTER.includes(payload.reason)) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          tree = store.tags();
          buildCloud();
          renderDetail();
          renderIndex();
        }, 120);
      }
    }
    const CLUSTER = ["add", "add-many", "delete", "restore", "import", "reset", "clear", "review", "update"];
    const off = store.on("change", onStoreChange);

    function onVisibility() {
      if (!mounted) return;
      if (document.hidden) {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = 0;
      } else if (!frameId && cloudTags.length && !destroyed) {
        lastFrame = 0;
        frameId = requestAnimationFrame(animate);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return {
      el: root,
      mount,
      destroy() {
        destroyed = true;
        mounted = false;
        off();
        document.removeEventListener("visibilitychange", onVisibility);
        if (ro) ro.disconnect();
        if (frameId) cancelAnimationFrame(frameId);
        clearTimeout(resizeTimer);
        ctx.app.tagSelection = selected;
      },
      selectTag,
    };
  };
})();
