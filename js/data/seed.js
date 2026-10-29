/* ==========================================================================
   Demo content — 16 pieces of "看得见的生活"
   Links point to platform searches so they never rot.
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const seed = (SZL.seed = {});

  function daysAgo(n, hour, minute) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  }

  function plusHours(iso, hours) {
    return new Date(new Date(iso).getTime() + hours * 3600 * 1000).toISOString();
  }

  function searchUrl(source, title) {
    const q = encodeURIComponent(title);
    switch (source) {
      case "bilibili":
        return "https://search.bilibili.com/all?keyword=" + q;
      case "xiaohongshu":
        return "https://www.xiaohongshu.com/search_result?keyword=" + q;
      case "zhihu":
        return "https://www.zhihu.com/search?type=content&q=" + q;
      case "wechat":
        return "https://weixin.sogou.com/weixin?type=2&query=" + q;
      case "douyin":
        return "https://www.douyin.com/search/" + q;
      default:
        return "https://www.bing.com/search?q=" + q;
    }
  }

  const RAW = [
    {
      id: "demo-01",
      title: "为什么你的房间总是乱的？聊聊物品与注意力",
      source: "bilibili",
      author: "拾光建筑",
      duration: "12:40",
      cover: "assets/covers/interior.jpg",
      shape: "tall",
      summary:
        "房间的秩序是注意力的外化。视频把收纳拆成三件事：减少视觉噪音、给每件东西一个固定落点、把“顺手”变成设计。",
      note: "原来乱的不是房间，是我每次经过都要做一次微小的决定。决定太多，人就累了。",
      rating: 4,
      tags: ["生活/居住", "认知/注意力"],
      ago: [2, 21, 40],
    },
    {
      id: "demo-02",
      title: "把手机调成灰度一周后，我的屏幕时间少了 47%",
      source: "xiaohongshu",
      author: "一颗慢星球",
      cover: "assets/covers/desk.jpg",
      shape: "wide",
      summary:
        "去色不是戒断，而是让“无意识滑动”变得不那么顺滑。作者记录了一周的屏幕时间曲线，和重新长出来的空白。",
      note: "试了两天。最明显的变化是，刷到广告会立刻划走。颜色真的是钩子。",
      rating: 5,
      tags: ["数字极简", "习惯"],
      ago: [3, 8, 20],
    },
    {
      id: "demo-03",
      title: "推荐算法的本质，是让你停在“稍微不舒服”的地方",
      source: "zhihu",
      author: "界面之外",
      cover: "assets/covers/algorithm.jpg",
      shape: "square",
      summary:
        "完全满足会让你离开，完全无聊也会。最赚钱的状态是轻微的匮乏感——刚好想再刷一条。",
      note: "这句话可以当作停止刷手机的咒语。匮乏感是被设计出来的，不是我的问题。",
      rating: 5,
      tags: ["算法", "认知/注意力"],
      ago: [4, 23, 10],
    },
    {
      id: "demo-04",
      title: "在不被打断的地方，重新学会读完一本书",
      source: "wechat",
      author: "慢读实验室",
      cover: "assets/covers/library.jpg",
      shape: "tall",
      summary:
        "作者把阅读拆成选书、切分、复述三件事，并给出一个很朴素的建议：每天只读二十分钟，但不带手机进房间。",
      note: "上周在咖啡馆读完了四十页，回家又打开手机。环境比意志力可靠。",
      rating: 3,
      tags: ["阅读", "专注"],
      ago: [5, 20, 5],
    },
    {
      id: "demo-05",
      title: "一口气看完包豪斯：设计如何被现代主义重塑",
      source: "bilibili",
      author: "设计史放映厅",
      duration: "18:22",
      cover: "assets/covers/bauhaus.jpg",
      shape: "wide",
      summary:
        "从魏玛到德绍，包豪斯把“形式追随功能”变成一种生活方式。最后十分钟讲它对今天界面设计的影响。",
      note: "原来“少即是多”最早不是美学口号，而是材料与预算的限制。限制长出风格。",
      rating: 4,
      tags: ["设计/设计史", "阅读"],
      ago: [7, 14, 30],
    },
    {
      id: "demo-06",
      title: "2025 年度九宫格：记录比结果重要",
      source: "xiaohongshu",
      author: "胶卷备忘录",
      cover: "assets/covers/kyoto.jpg",
      shape: "square",
      summary:
        "九张照片，九个普通的下午。作者说，年度总结不是 KPI 复盘，而是提醒自己曾经在哪些时刻真的在场。",
      note: "我也想做一个版本，不选“最好看”的，选“当时最放松”的。",
      rating: 3,
      tags: ["影像/街头", "生活"],
      ago: [8, 22, 15],
    },
    {
      id: "demo-07",
      title: "为什么我们记得刷到过，却说不清看了什么",
      source: "zhihu",
      author: "认知偏误收集者",
      cover: "assets/covers/memory.jpg",
      shape: "tall",
      summary:
        "文章区分了“熟悉感”和“记得”：反复曝光会制造知道的错觉，但提取仍然失败。真正的记忆需要一次主动复述。",
      note: "所以回顾区的意义，也许不是记笔记，而是提取练习。每次写一句，都是把熟悉感换成记忆。",
      rating: 5,
      tags: ["认知/记忆", "笔记方法"],
      ago: [9, 12, 0],
    },
    {
      id: "demo-08",
      title: "留白的价值：从宋代山水到界面设计",
      source: "wechat",
      author: "看见设计",
      cover: "assets/covers/whitespace.jpg",
      shape: "wide",
      summary:
        "留白不是空，是让视线有地方停。作者用马远《寒江独钓图》和几个产品界面做对照，讲密度与呼吸的关系。",
      note: "我们的信息流之所以让人疲惫，是因为每一格都在喊“看我”。",
      rating: 4,
      tags: ["设计/美学", "专注"],
      ago: [11, 18, 50],
    },
    {
      id: "demo-09",
      title: "用 30 天记录通勤路上的光",
      source: "bilibili",
      author: "早八观察员",
      duration: "08:31",
      cover: "assets/covers/commute.jpg",
      shape: "tall",
      summary:
        "固定的路线，拍出了三十张不同的光。作者说，重复不是无聊，是让你终于看得见变化。",
      note: "明天试试不带耳机走一段。可能我会听见别的。",
      rating: 4,
      tags: ["影像/光影", "城市"],
      ago: [13, 7, 45],
    },
    {
      id: "demo-10",
      title: "极简不是扔东西，是决定留下什么",
      source: "xiaohongshu",
      author: "空房间计划",
      cover: "assets/covers/minimal.jpg",
      shape: "square",
      summary:
        "一次搬家让作者重新回答“我到底需要什么”。她留下了三十七件物品，也留下了三个习惯。",
      note: "我一直把极简当成清理任务。也许它其实是一道关于“我是谁”的选择题。",
      rating: 4,
      tags: ["生活/居住", "极简"],
      ago: [15, 16, 20],
    },
    {
      id: "demo-11",
      title: "深度工作之后，我反而更累了",
      source: "wechat",
      author: "注意力研究小组",
      cover: "assets/covers/ocean.jpg",
      shape: "wide",
      summary:
        "高强度专注会透支恢复能力。作者提出“注意力预算”，并把休息也写进日程表，而不是等累到不能动。",
      note: "这就是现在的我。把休息排进日程，听起来荒谬，但可能是唯一有效的办法。",
      rating: 3,
      tags: ["效率", "心理"],
      ago: [17, 21, 0],
    },
    {
      id: "demo-12",
      title: "一个人做饭的第七年",
      source: "bilibili",
      author: "厨房里的第三人",
      duration: "06:12",
      cover: "assets/covers/kitchen.jpg",
      shape: "tall",
      summary:
        "没有教程，只有一个人从买菜到洗碗的完整过程，和一句“好好吃饭是最低成本的自我照顾”。",
      note: "一个人吃饭也要用好看的碗。这不是仪式感，是不想敷衍自己。",
      rating: 5,
      tags: ["生活/饮食", "生活"],
      ago: [19, 12, 10],
    },
    {
      id: "demo-13",
      title: "如何评价“数字花园”这种笔记方式",
      source: "zhihu",
      author: "笔记方法与工具",
      cover: "assets/covers/book.jpg",
      shape: "square",
      summary:
        "数字花园强调未完成和链接，而不是分类归档。它承认想法会生长，也允许它们长得乱。",
      note: "这个应用大概就是我的数字花园。不追求完整，只求每次回来都能看见新的连接。",
      rating: 4,
      tags: ["笔记方法", "阅读"],
      ago: [21, 10, 30],
    },
    {
      id: "demo-14",
      title: "把待办清单换成“已完成清单”的第一周",
      source: "xiaohongshu",
      author: "今天也完成了一点点",
      cover: "assets/covers/notes.jpg",
      shape: "wide",
      summary:
        "不再追问还有什么没做，而是记录今天做成了什么。作者说，这让她重新获得了对时间的掌控感。",
      note: "今晚就写三条。哪怕只是“洗了碗”。",
      rating: 3,
      tags: ["习惯", "效率"],
      ago: [23, 23, 30],
    },
    {
      id: "demo-15",
      title: "植物教会我的事：慢一点，也没关系",
      source: "xiaohongshu",
      author: "窗台观察日记",
      cover: "assets/covers/plant.jpg",
      shape: "tall",
      summary:
        "浇水、等新叶、接受枯掉的一枝。植物不催促你，也不评价你，它只是按自己的节奏长。",
      note: "",
      rating: 0,
      tags: [],
      ago: [1, 9, 15],
    },
    {
      id: "demo-16",
      title: "把周末还给散步",
      source: "wechat",
      author: "城市漫游指南",
      cover: "assets/covers/walk.jpg",
      shape: "square",
      summary:
        "不需要目的地，不需要步数。文章记录了一次没有手机的散步，以及路上重新出现的细节。",
      note: "",
      rating: 0,
      tags: [],
      ago: [0, 7, 30],
    },
  ];

  seed.create = function create() {
    const items = RAW.map((entry) => {
      const likedAt = daysAgo(entry.ago[0], entry.ago[1], entry.ago[2]);
      const hasReview = entry.rating > 0 || entry.note;
      return {
        id: entry.id,
        title: entry.title,
        url: searchUrl(entry.source, entry.title),
        source: entry.source,
        author: entry.author,
        cover: entry.cover,
        summary: entry.summary,
        duration: entry.duration || "",
        shape: entry.shape,
        likedAt,
        createdAt: likedAt,
        updatedAt: hasReview ? plusHours(likedAt, 20) : likedAt,
        review: {
          rating: entry.rating || 0,
          note: entry.note || "",
          tags: entry.tags || [],
          reviewedAt: hasReview ? plusHours(likedAt, 20) : null,
        },
      };
    });

    const state = SZL.model.createState(items);
    state.meta.demo = true;
    state.meta.createdAt = daysAgo(26, 10, 0);
    state.meta.updatedAt = daysAgo(0, 7, 35);
    state.settings.demoNoticeDismissed = false;
    return SZL.model.normalizeState(state);
  };

  seed.empty = function empty() {
    const state = SZL.model.createState([]);
    state.meta.demo = false;
    return state;
  };
})();
