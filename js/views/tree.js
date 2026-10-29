/* ==========================================================================
   Memory tree — branches are tags, leaves are notes
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const util = SZL.util;
  const model = SZL.model;
  const views = (SZL.views = SZL.views || {});

  const W = 1200;
  const H = 820;
  const GROUND = 742;
  const TRUNK_X = 600;
  const SVG_NS = "http://www.w3.org/2000/svg";

  const PALETTE = [
    "var(--accent)",
    "var(--moss)",
    "var(--gold)",
    "var(--slate)",
    "var(--plum)",
    "#8b6f47",
    "#6f7f6a",
    "#9b6a54",
  ];

  function svgEl(tag, attrs, children) {
    const node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach((key) => {
        if (attrs[key] != null) node.setAttribute(key, attrs[key]);
      });
    }
    if (children) {
      children.forEach((child) => child && node.appendChild(child));
    }
    return node;
  }

  function qPoint(p0, p1, p2, t) {
    const mt = 1 - t;
    return {
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    };
  }

  function qTangent(p0, p1, p2, t) {
    return {
      x: 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
      y: 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
    };
  }

  function norm(v) {
    const len = Math.hypot(v.x, v.y) || 1;
    return { x: v.x / len, y: v.y / len };
  }

  function leafPath() {
    return "M0 0C7-11 18-13 27 0 18 13 7 11 0 0Z";
  }

  views.tree = function treeView(ctx) {
    const store = ctx.store;
    const root = util.el("div", { class: "page tree-page view-enter" });
    const tree = store.tags();
    const stats = store.stats();
    let drawnLeaves = 0;

    /* ---------------- header ---------------- */

    const head = util.el("header", { class: "page-head" });
    const eyebrow = util.el("div", {
      class: "eyebrow",
      text: "MEMORY TREE · 记忆的形状 · " + util.todayLabel(),
    });
    const headGrid = util.el("div", { class: "head-grid" });
    const title = util.el("h1", { class: "head-title" }, [
      util.el("span", { text: "树" }),
      util.el("span", { class: "title-en", text: "memory tree" }),
      util.el("span", { class: "title-count", text: String(stats.notes).padStart(2, "0") }),
    ]);
    headGrid.appendChild(title);
    headGrid.appendChild(
      util.el("div", { class: "head-side" }, [
        util.el("p", {
          class: "lede",
          text:
            "每根枝干是一条标签，每片叶子是一条感想。你写得越多，它就长得越像你。同一条感想若有多枚标签，会同时长在几根枝干上。",
        }),
        util.el("div", { class: "tree-legend" }, [
          util.el("span", { class: "tree-legend-item" }, [
            util.el("span", { class: "tree-legend-branch" }),
            util.el("span", { text: "枝干 = 标签" }),
          ]),
          util.el("span", { class: "tree-legend-item" }, [
            util.el("span", { class: "tree-legend-leaf" }),
            util.el("span", { text: "叶子 = 感想" }),
          ]),
          util.el("span", { class: "tree-legend-hint", text: "点击叶子查看原委" }),
        ]),
      ])
    );
    head.appendChild(eyebrow);
    head.appendChild(headGrid);

    /* ---------------- stage ---------------- */

    const stage = util.el("section", { class: "tree-stage", attrs: { "aria-label": "记忆树" } });
    const svg = svgEl("svg", {
      class: "tree-svg",
      viewBox: "0 40 " + W + " " + (H - 40),
      role: "img",
      "aria-label": "由标签与感想构成的树",
      preserveAspectRatio: "xMidYMid meet",
    });
    const tip = util.el("div", { class: "tree-tip", attrs: { "aria-hidden": "true" } });
    stage.appendChild(svg);
    stage.appendChild(tip);

    const defs = svgEl("defs");
    const moonGrad = svgEl("radialGradient", { id: "moonGlow", cx: "50%", cy: "50%", r: "50%" }, [
      svgEl("stop", { offset: "0%", style: "stop-color: var(--accent); stop-opacity: .22" }),
      svgEl("stop", { offset: "60%", style: "stop-color: var(--accent); stop-opacity: .06" }),
      svgEl("stop", { offset: "100%", style: "stop-color: var(--accent); stop-opacity: 0" }),
    ]);
    defs.appendChild(moonGrad);
    svg.appendChild(defs);

    const sky = svgEl("g", { class: "tree-sky" });
    sky.appendChild(svgEl("circle", { cx: "914", cy: "196", r: "150", fill: "url(#moonGlow)" }));
    sky.appendChild(
      svgEl("circle", {
        cx: "914",
        cy: "196",
        r: "96",
        fill: "none",
        stroke: "var(--accent)",
        "stroke-opacity": "0.16",
        "stroke-width": "1",
      })
    );
    [
      [742, 118, 1.5],
      [1058, 92, 1.2],
      [1108, 262, 1],
      [790, 64, 1],
      [1024, 338, 1.4],
      [688, 210, 1],
    ].forEach(([x, y, r]) => {
      sky.appendChild(
        svgEl("circle", { cx: x, cy: y, r: r, fill: "var(--ink-3)", opacity: "0.3" })
      );
    });
    svg.appendChild(sky);

    const branchesLayer = svgEl("g", { class: "tree-branches" });
    const leavesLayer = svgEl("g", { class: "tree-leaves" });
    const labelsLayer = svgEl("g", { class: "tree-labels" });
    const groundLayer = svgEl("g", { class: "tree-ground" });

    /* ---------------- ground ---------------- */

    groundLayer.appendChild(
      svgEl("path", {
        d:
          "M60 " +
          GROUND +
          " C 220 " +
          (GROUND - 6) +
          ", 380 " +
          (GROUND + 4) +
          ", 600 " +
          GROUND +
          " S 980 " +
          (GROUND - 6) +
          ", 1140 " +
          (GROUND - 1),
        fill: "none",
        stroke: "var(--line-strong)",
        "stroke-width": "1.2",
      })
    );
    for (let i = 0; i < 52; i++) {
      const x = 80 + i * 20.4;
      const h = 3 + ((i * 7) % 6);
      groundLayer.appendChild(
        svgEl("path", {
          d: "M" + x + " " + GROUND + "l" + (i % 2 ? 2 : -2) + " " + -h,
          stroke: "var(--ink-4)",
          "stroke-opacity": "0.5",
          "stroke-width": "0.8",
          "stroke-linecap": "round",
        })
      );
    }

    // roots
    [
      "M598 742C566 758 530 772 486 790",
      "M604 742C650 762 694 776 742 792",
      "M600 744C588 770 566 790 540 806",
      "M602 744C622 768 648 786 676 800",
    ].forEach((d, i) => {
      const path = svgEl("path", {
        d,
        fill: "none",
        stroke: "var(--ink-4)",
        "stroke-width": String(5 - i * 0.8),
        "stroke-opacity": "0.42",
        "stroke-linecap": "round",
      });
      groundLayer.appendChild(path);
      path.dataset.draw = "root";
    });

    /* ---------------- trunk ---------------- */

    const trunkLayer = svgEl("g", { class: "tree-trunk" });
    const trunkPath = svgEl("path", {
      d:
        "M588 756C585 690 595 606 598 520 599 508 600 500 600 496L603 496C604 500 605 508 608 520 611 606 618 690 613 756Z",
      fill: "var(--ink-3)",
      "fill-opacity": "0.92",
      stroke: "none",
    });
    trunkLayer.appendChild(trunkPath);
    // A single bark line near the wide base; the upper trunk is too narrow for texture.
    trunkLayer.appendChild(
      svgEl("path", {
        d: "M595 748C594 726 594 706 595 684",
        fill: "none",
        stroke: "var(--ink-2)",
        "stroke-width": "1",
        "stroke-opacity": "0.18",
        "stroke-linecap": "round",
      })
    );
    trunkLayer.appendChild(
      svgEl("ellipse", {
        cx: "606",
        cy: "660",
        rx: "2.4",
        ry: "4.5",
        fill: "var(--ink-2)",
        opacity: "0.14",
      })
    );
    const treeBody = svgEl("g", {
      class: "tree-body",
      transform: "translate(600 742) scale(1.22) translate(-600 -742)",
    });
    svg.appendChild(groundLayer);
    svg.appendChild(treeBody);
    treeBody.appendChild(trunkLayer);

    /* ---------------- branches ---------------- */

    const data = buildData();
    if (!data.branches.length) {
      treeBody.appendChild(branchesLayer);
      treeBody.appendChild(leavesLayer);
      treeBody.appendChild(labelsLayer);
      stage.appendChild(emptyTree());
      svg.style.opacity = "0.18";
    } else {
      data.branches.forEach((branch, index) => {
        drawBranch(branch, index);
      });
      treeBody.appendChild(branchesLayer);
      treeBody.appendChild(leavesLayer);
      treeBody.appendChild(labelsLayer);
    }

    /* ---------------- compact tree for narrow screens ---------------- */

    function buildMobileTree(branches) {
      const wrap = util.el("section", {
        class: "tree-mobile",
        attrs: { "aria-label": "记忆树列表" },
      });
      if (!branches.length) {
        const empty = util.el("div", { class: "tree-mobile-empty" }, [
          util.el("p", { text: "这棵树还没有发芽。" }),
          util.el("p", {
            text: "去回看里写下第一条带标签的感想，标签会长成枝干，感想会变成叶子。",
          }),
          util.el("button", {
            class: "btn btn-primary btn-sm",
            attrs: { type: "button" },
            html: util.icon("plus", 13) + "<span>收下一条</span>",
            on: { click: () => ctx.app.openCapture() },
          }),
        ]);
        wrap.appendChild(empty);
        return wrap;
      }
      branches.forEach((branch) => {
        const section = util.el("div", {
          class: "tm-branch",
          style: { "--branch": branch.color },
        });
        const tagBtn = util.el("button", {
          class: "tm-tag",
          attrs: { type: "button" },
          on: { click: () => ctx.app.openTag(branch.node.path) },
        }, [
          util.el("span", { class: "tm-node" }),
          util.el("span", { class: "tm-name", text: branch.node.name }),
          util.el("span", { class: "tm-count", text: String(branch.node.total) }),
          util.el("span", { class: "tm-arrow", html: util.icon("arrowRight", 11) }),
        ]);
        section.appendChild(tagBtn);

        const leaves = util.el("div", { class: "tm-leaves" });
        if (!branch.notes.length) {
          leaves.appendChild(
            util.el("div", { class: "tm-empty", text: "这根枝干还没有长出叶子。" })
          );
        } else {
          branch.notes.slice(0, 6).forEach((item) => {
            const meta = model.sourceMeta(item.source);
            leaves.appendChild(
              util.el("button", {
                class: "tm-leaf",
                attrs: { type: "button" },
                on: { click: () => openNote(item, branch.node.path) },
              }, [
                util.el("span", {
                  class: "tm-leaf-icon",
                  html:
                    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c0-8 5-13 15-13 0 9-5 13-12 13"/><path d="M5 19c2-5 5-8 10-10"/></svg>',
                }),
                util.el("span", { class: "tm-quote", text: item.review.note }),
                util.el("span", {
                  class: "tm-meta",
                  text:
                    util.formatShortDate(item.review.reviewedAt || item.likedAt) +
                    " · " +
                    meta.label,
                }),
              ])
            );
          });
          if (branch.notes.length > 6) {
            leaves.appendChild(
              util.el("button", {
                class: "tm-more",
                attrs: { type: "button" },
                text: "还有 " + (branch.notes.length - 6) + " 片叶子 →",
                on: { click: () => ctx.app.openTag(branch.node.path) },
              })
            );
          }
        }
        section.appendChild(leaves);
        wrap.appendChild(section);
      });
      return wrap;
    }

    const mobileTree = buildMobileTree(data.branches);

    function buildData() {
      const top = tree.top.slice(0, 7);
      const items = store.items();
      const branches = top.map((node, index) => {
        const notes = items
          .filter(
            (item) =>
              item.review &&
              item.review.note &&
              item.review.note.trim() &&
              (item.review.tags || []).some(
                (tag) => tag === node.path || tag.startsWith(node.path + "/")
              )
          )
          .sort(
            (a, b) =>
              new Date(a.review.reviewedAt || a.likedAt) -
              new Date(b.review.reviewedAt || b.likedAt)
          );
        const rand = util.mulberry32(util.hash(node.path) ^ 0x9e3779b9);
        const n = top.length;
        const spreadFrom = -166;
        const spreadTo = -14;
        const baseAngle =
          n === 1 ? -90 : spreadFrom + (index * (spreadTo - spreadFrom)) / (n - 1);
        const angle = baseAngle + (rand() - 0.5) * 7;
        const rad = (angle * Math.PI) / 180;
        const verticality = 1 - Math.abs(angle + 90) / 70;
        const baseY = util.clamp(
          662 - 170 * Math.max(0, verticality) + (rand() - 0.5) * 22,
          480,
          690
        );
        const length = 316 - 88 * Math.max(0, verticality) + rand() * 28;
        const start = {
          x: TRUNK_X + (754 - baseY) * 0.02,
          y: baseY,
        };
        let end = {
          x: start.x + Math.cos(rad) * length,
          y: start.y + Math.sin(rad) * length,
        };
        end.x = util.clamp(end.x, 74, W - 74);
        end.y = util.clamp(end.y, 58, 630);
        const normal = { x: -Math.sin(rad), y: Math.cos(rad) };
        const bow = (index % 2 === 0 ? -1 : 1) * (16 + rand() * 16);
        const ctrl = {
          x: (start.x + end.x) / 2 + normal.x * bow,
          y: (start.y + end.y) / 2 + normal.y * bow,
        };
        return {
          node,
          notes,
          color: PALETTE[index % PALETTE.length],
          angle,
          start,
          ctrl,
          end,
          rand,
        };
      });
      return { branches };
    }

    function drawBranch(branch, index) {
      const color = branch.color;
      const path = svgEl("path", {
        d: "M" + branch.start.x + " " + branch.start.y + "Q" + branch.ctrl.x + " " + branch.ctrl.y + " " + branch.end.x + " " + branch.end.y,
        fill: "none",
        stroke: color,
        "stroke-width": String(5.4 - index * 0.1),
        "stroke-opacity": "0.72",
        "stroke-linecap": "round",
      });
      path.dataset.draw = "branch";
      path.style.setProperty("--branch", color);
      branchesLayer.appendChild(path);

      // decorative forks
      const forkRand = util.mulberry32(util.hash(branch.node.path) ^ 0x51ed270b);
      for (let f = 0; f < 2; f++) {
        const t = 0.45 + f * 0.2 + forkRand() * 0.08;
        const p = qPoint(branch.start, branch.ctrl, branch.end, t);
        const tangent = norm(qTangent(branch.start, branch.ctrl, branch.end, t));
        const side = f % 2 === 0 ? 1 : -1;
        const normal = { x: -tangent.y * side, y: tangent.x * side };
        const forkLen = 34 + forkRand() * 26;
        const forkEnd = {
          x: p.x + normal.x * forkLen + tangent.x * 10,
          y: p.y + normal.y * forkLen + tangent.y * 10,
        };
        const forkCtrl = {
          x: p.x + normal.x * forkLen * 0.6 + tangent.x * 2,
          y: p.y + normal.y * forkLen * 0.6,
        };
        const fork = svgEl("path", {
          d: "M" + p.x + " " + p.y + "Q" + forkCtrl.x + " " + forkCtrl.y + " " + forkEnd.x + " " + forkEnd.y,
          fill: "none",
          stroke: color,
          "stroke-width": "1.5",
          "stroke-opacity": "0.45",
          "stroke-linecap": "round",
        });
        fork.dataset.draw = "twig";
        branchesLayer.appendChild(fork);
        const bud = svgEl("circle", {
          cx: forkEnd.x,
          cy: forkEnd.y,
          r: "2.4",
          fill: color,
          opacity: "0.35",
        });
        branchesLayer.appendChild(bud);
      }

      // quiet buds along the main branch give the silhouette some texture
      for (let b = 0; b < 3; b++) {
        const t = 0.22 + b * 0.22 + forkRand() * 0.05;
        const p = qPoint(branch.start, branch.ctrl, branch.end, t);
        branchesLayer.appendChild(
          svgEl("circle", {
            cx: p.x,
            cy: p.y,
            r: String(1.6 + forkRand() * 1.2),
            fill: color,
            opacity: "0.28",
          })
        );
      }

      // a quiet tip so the label feels attached to the branch
      branchesLayer.appendChild(
        svgEl("circle", {
          cx: branch.end.x,
          cy: branch.end.y,
          r: "3",
          fill: color,
          opacity: "0.3",
        })
      );

      // leaves (one per note, capped)
      const maxLeaves = 7;
      const notes = branch.notes.slice(0, maxLeaves);
      notes.forEach((item, i) => {
        const rand = util.mulberry32(util.hash(item.id) ^ util.hash(branch.node.path));
        const t = 0.3 + ((i + 1) / (notes.length + 1)) * 0.62 + (rand() - 0.5) * 0.04;
        const p = qPoint(branch.start, branch.ctrl, branch.end, t);
        const tangent = norm(qTangent(branch.start, branch.ctrl, branch.end, t));
        const side = i % 2 === 0 ? 1 : -1;
        const normal = { x: -tangent.y * side, y: tangent.x * side };
        const twigLen = 20 + rand() * 24;
        const base = {
          x: p.x + normal.x * twigLen + tangent.x * 6,
          y: p.y + normal.y * twigLen + tangent.y * 6,
        };
        const twig = svgEl("path", {
          d:
            "M" +
            p.x +
            " " +
            p.y +
            "Q" +
            (p.x + normal.x * twigLen * 0.7) +
            " " +
            (p.y + normal.y * twigLen * 0.7) +
            " " +
            base.x +
            " " +
            base.y,
          fill: "none",
          stroke: color,
          "stroke-width": "1.1",
          "stroke-opacity": "0.5",
          "stroke-linecap": "round",
        });
        twig.dataset.draw = "twig";
        branchesLayer.appendChild(twig);

        const leafAngle =
          (Math.atan2(tangent.y * 0.6 + normal.y, tangent.x * 0.6 + normal.x) * 180) /
            Math.PI +
          (side > 0 ? 18 : -18);
        const scale = 0.9 + rand() * 0.38;

        const group = svgEl("g", {
          class: "leaf",
          transform:
            "translate(" + base.x + " " + base.y + ") rotate(" + leafAngle + ") scale(" + scale + ")",
          tabindex: "0",
          role: "button",
          "aria-label": "感想：" + util.truncate(item.review.note, 30),
          "data-id": item.id,
          "data-tag": branch.node.path,
        }, [
          svgEl("title", {}, []),
        ]);
        group.querySelector("title").textContent = item.review.note;
        const body = svgEl("path", {
          d: leafPath(),
          class: "leaf-body",
          style: "--leaf:" + color,
        });
        const vein = svgEl("path", {
          d: "M1 0C9 0 18 0 25 0",
          class: "leaf-vein",
        });
        group.appendChild(body);
        group.appendChild(vein);
        group.appendChild(
          svgEl("circle", {
            cx: "13",
            cy: "0",
            r: "17",
            fill: "transparent",
            class: "leaf-hit",
          })
        );
        group.style.animationDelay = 900 + drawnLeaves * 25 + "ms";
        group.dataset.delay = String(900 + drawnLeaves * 25);
        drawnLeaves += 1;

        group.addEventListener("mouseenter", () => showTip(item, group));
        group.addEventListener("mouseleave", hideTip);
        group.addEventListener("focus", () => showTip(item, group));
        group.addEventListener("blur", hideTip);
        group.addEventListener("click", () => openNote(item, branch.node.path));
        group.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openNote(item, branch.node.path);
          }
        });

        leavesLayer.appendChild(group);
      });

      if (branch.notes.length > maxLeaves) {
        const extra = svgEl("text", {
          x: branch.end.x,
          y: branch.end.y + 34,
          class: "branch-more",
          "text-anchor": "middle",
        });
        extra.textContent = "还有 " + (branch.notes.length - maxLeaves) + " 片叶子";
        leavesLayer.appendChild(extra);
      }

      // label
      const dirX = Math.cos((branch.angle * Math.PI) / 180);
      const label = svgEl("g", {
        class: "branch-label",
        tabindex: "0",
        role: "link",
        "aria-label": "查看标签 " + branch.node.path,
        "data-tag": branch.node.path,
      });
      let anchor = "middle";
      let x = branch.end.x;
      let y = branch.end.y - 22;
      if (dirX > 0.32) {
        anchor = "start";
        x = branch.end.x + 10;
        y = branch.end.y - 2;
      } else if (dirX < -0.32) {
        anchor = "end";
        x = branch.end.x - 10;
        y = branch.end.y - 2;
      }
      const text = svgEl("text", {
        x: x,
        y: y,
        class: "branch-name",
        "text-anchor": anchor,
      });
      const nameSpan = svgEl("tspan", {}, []);
      nameSpan.textContent = branch.node.name;
      const countSpan = svgEl("tspan", { class: "branch-count", dx: "6" });
      countSpan.textContent = String(branch.node.total);
      text.appendChild(nameSpan);
      text.appendChild(countSpan);
      label.appendChild(text);
      label.addEventListener("click", () => ctx.app.openTag(branch.node.path));
      label.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          ctx.app.openTag(branch.node.path);
        }
      });
      labelsLayer.appendChild(label);
    }

    /* ---------------- interactions ---------------- */

    function showTip(item, group) {
      const meta = model.sourceMeta(item.source);
      util.clear(tip);
      tip.appendChild(
        util.el("div", { class: "tip-meta" }, [
          util.el("span", { text: meta.label }),
          util.el("span", { class: "tip-dot" }),
          util.el("span", { text: util.formatShortDate(item.review.reviewedAt || item.likedAt) }),
        ])
      );
      tip.appendChild(util.el("p", { class: "tip-note", text: util.truncate(item.review.note, 76) }));
      tip.appendChild(
        util.el("div", { class: "tip-title", text: "《" + util.truncate(item.title, 26) + "》" })
      );
      const stageRect = stage.getBoundingClientRect();
      const rect = group.getBoundingClientRect();
      tip.style.left = rect.left - stageRect.left + rect.width / 2 + "px";
      tip.style.top = rect.top - stageRect.top - 8 + "px";
      tip.classList.add("is-visible");
    }

    function hideTip() {
      tip.classList.remove("is-visible");
    }

    function openNote(item, tagPath) {
      const meta = model.sourceMeta(item.source);
      const content = util.el("div", { class: "tree-note" });
      content.appendChild(
        util.el("div", { class: "tree-note-meta" }, [
          util.el("span", { class: "tree-note-src", text: meta.label }),
          util.el("span", { class: "tree-note-sep" }),
          util.el("span", { text: util.formatDate(item.review.reviewedAt || item.likedAt) }),
          util.el("span", { class: "tree-note-sep" }),
          util.el("span", { text: "评分 " + (item.review.rating || 0) + " / 5" }),
        ])
      );
      content.appendChild(util.el("blockquote", { class: "tree-note-quote", text: item.review.note }));
      content.appendChild(
        util.el("div", { class: "tree-note-source" }, [
          util.el("div", { class: "tree-note-title", text: item.title }),
          util.el("p", { class: "tree-note-summary", text: item.summary || "没有摘要。" }),
        ])
      );
      const tags = util.el("div", { class: "tree-note-tags" });
      (item.review.tags || []).forEach((tag) => {
        tags.appendChild(
          util.el("button", {
            class: "tag",
            attrs: { type: "button" },
            text: tag,
            on: {
              click: () => {
                SZL.ui.closeDrawer();
                ctx.app.openTag(tag);
              },
            },
          })
        );
      });
      content.appendChild(tags);

      const actions = util.el("div", { class: "tree-note-actions" });
      actions.appendChild(
        util.el("button", {
          class: "btn btn-primary",
          attrs: { type: "button" },
          text: "在回看中展开",
          on: {
            click: () => {
              SZL.ui.closeDrawer();
              ctx.app.openItem(item.id);
            },
          },
        })
      );
      if (item.url) {
        actions.appendChild(
          util.el("a", {
            class: "btn btn-ghost",
            attrs: { href: item.url, target: "_blank", rel: "noopener noreferrer" },
            html: util.icon("external", 13) + "<span>原链接</span>",
          })
        );
      }
      content.appendChild(actions);

      SZL.ui.drawer({
        eyebrow: "# " + tagPath,
        title: "一片叶子",
        subtitle: "一条被留下来的感想",
        content,
      });
    }

    function emptyTree() {
      const overlay = util.el("div", { class: "tree-empty" });
      overlay.appendChild(
        util.el("p", {
          class: "tree-empty-title",
          text: "这棵树还没有发芽",
        })
      );
      overlay.appendChild(
        util.el("p", {
          class: "tree-empty-text",
          text: "去回看里写下第一条带标签的感想。标签会长成枝干，感想会变成叶子。",
        })
      );
      overlay.appendChild(
        util.el("button", {
          class: "btn btn-primary",
          attrs: { type: "button" },
          html: util.icon("plus", 14) + "<span>收下一条</span>",
          on: { click: () => ctx.app.openCapture() },
        })
      );
      return overlay;
    }

    svg.appendChild(svgEl("g"));

    const footer = util.el("footer", { class: "page-foot" }, [
      util.el("span", {
        class: "philosophy",
        text: "一个人反复写下什么，就会慢慢长成什么。",
      }),
      util.el("span", { class: "foot-mono", text: "TREE · " + tree.top.length + " BRANCHES" }),
    ]);
    root.appendChild(head);
    root.appendChild(stage);
    root.appendChild(mobileTree);
    root.appendChild(footer);

    /* ---------------- draw animations ---------------- */

    let mounted = false;

    function mount() {
      if (mounted) return;
      mounted = true;
      util.nextFrame(() => {
        if (util.prefersReducedMotion()) return;
        trunkLayer.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 1100,
          delay: 40,
          easing: "cubic-bezier(0.33, 0.9, 0.3, 1)",
          fill: "both",
        });
        groundLayer.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 900,
          delay: 0,
          easing: "ease-out",
          fill: "both",
        });
        const draws = svg.querySelectorAll("path[data-draw]");
        draws.forEach((path) => {
          let len = 0;
          try {
            len = path.getTotalLength();
          } catch (err) {
            len = 400;
          }
          if (!len) return;
          const isTrunk = path.dataset.draw === "trunk";
          const isRoot = path.dataset.draw === "root";
          path.animate(
            [
              { strokeDasharray: len + " " + len, strokeDashoffset: len },
              { strokeDasharray: len + " " + len, strokeDashoffset: 0 },
            ],
            {
              duration: isTrunk ? 1500 : isRoot ? 1000 : 950,
              delay: isTrunk ? 80 : isRoot ? 0 : 380,
              easing: "cubic-bezier(0.33, 0.9, 0.3, 1)",
              fill: "both",
            }
          );
        });
        svg.querySelectorAll(".leaf").forEach((leaf) => {
          leaf.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 520,
            delay: Number(leaf.dataset.delay) || 900,
            easing: "ease-out",
            fill: "both",
          });
        });
      });
    }

    /* ---------------- data changes ---------------- */

    const off = store.on("change", (payload) => {
      if (
        ["add", "add-many", "delete", "restore", "import", "reset", "clear", "review"].includes(
          payload.reason
        )
      ) {
        // Rebuild by re-entering the page keeps the geometry honest.
        const delay = payload.reason === "review" ? 900 : 0;
        clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(() => {
          if (ctx.app.route === "tree") ctx.app.navigate("tree");
        }, delay);
      }
    });
    let rebuildTimer = null;

    return {
      el: root,
      mount,
      destroy() {
        mounted = false;
        off();
        clearTimeout(rebuildTimer);
      },
    };
  };
})();
