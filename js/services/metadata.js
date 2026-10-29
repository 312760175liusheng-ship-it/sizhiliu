/* ==========================================================================
   Metadata: URL detection + optional oEmbed lookup + bulk paste parsing
   ========================================================================== */

(function () {
  "use strict";

  const SZL = (window.SZL = window.SZL || {});
  const meta = (SZL.metadata = {});
  const model = SZL.model;

  const URL_CHARS = "A-Za-z0-9\\-._~:/?#\\[\\]@!$&'()*+,;=%";
  const SCHEME_URL_RE = new RegExp("https?:\\/\\/[" + URL_CHARS + "]+", "gi");
  const BARE_URL_RE = new RegExp(
    "(?:^|[^A-Za-z0-9@._-])((?:[A-Za-z0-9-]+\\.)+(?:[A-Za-z]{2,})(?::\\d{1,5})?\\/[" +
      URL_CHARS +
      "]*)",
    "g"
  );
  const STRIP_URL_RE = new RegExp(
    "https?:\\/\\/[" +
      URL_CHARS +
      "]+|(?:[A-Za-z0-9-]+\\.)+(?:[A-Za-z]{2,})(?::\\d{1,5})?\\/[" +
      URL_CHARS +
      "]*",
    "gi"
  );

  const PLATFORM_HOSTS = [
    "bilibili.com",
    "b23.tv",
    "bili2233.cn",
    "xiaohongshu.com",
    "xhslink.com",
    "zhihu.com",
    "mp.weixin.qq.com",
    "weixin.qq.com",
    "douyin.com",
    "iesdouyin.com",
    "kuaishou.com",
    "weibo.com",
    "weibo.cn",
    "t.cn",
    "youtube.com",
    "youtu.be",
    "douban.com",
    "jianshu.com",
    "sspai.com",
    "36kr.com",
    "xiaoyuzhoufm.com",
  ];

  function normalizeText(text) {
    let value = String(text == null ? "" : text);
    value = value.replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "");
    try {
      value = value.normalize("NFKC");
    } catch (err) {
      /* older engines: keep the original text */
    }
    return value.replace(/\u00A0/g, " ");
  }

  function decodeEntities(text) {
    return String(text || "")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&nbsp;/gi, " ");
  }

  function trimUrl(raw) {
    let value = String(raw || "").trim();
    value = value.replace(/^[<"'“”‘’（(【「『《]+/, "");
    value = value.replace(/[>"'“”‘’】」』》]+$/g, "");
    for (let i = 0; i < 5; i++) {
      const before = value;
      value = value.replace(/[.,;:!?]+$/g, "");
      if (value.endsWith(")")) {
        const opens = (value.match(/\(/g) || []).length;
        const closes = (value.match(/\)/g) || []).length;
        if (closes > opens) value = value.slice(0, -1);
      }
      if (value.endsWith("]")) {
        const opens = (value.match(/\[/g) || []).length;
        const closes = (value.match(/\]/g) || []).length;
        if (closes > opens) value = value.slice(0, -1);
      }
      if (value === before) break;
    }
    return value;
  }

  function coerceUrl(input) {
    let value = trimUrl(decodeEntities(normalizeText(input)));
    if (!value) return "";
    if (/^\/\//.test(value)) value = "https:" + value;
    if (!/^https?:\/\//i.test(value)) {
      if (/^(?:www\.)?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?::\d+)?(?:[\/?#]|$)/.test(value)) {
        value = "https://" + value;
      } else {
        return "";
      }
    }
    if (/\s/.test(value) || /[\u3400-\u9fff]/.test(value)) return "";
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      if (!url.hostname || url.hostname.indexOf(".") === -1) return "";
      return url.toString();
    } catch (err) {
      return "";
    }
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch (err) {
      return "";
    }
  }

  function isKnownHost(host) {
    return PLATFORM_HOSTS.some(
      (domain) => host === domain || host.endsWith("." + domain)
    );
  }

  function collectCandidates(text) {
    const source = decodeEntities(normalizeText(text));
    const found = [];
    let match = null;

    SCHEME_URL_RE.lastIndex = 0;
    while ((match = SCHEME_URL_RE.exec(source))) {
      const url = coerceUrl(match[0]);
      if (!url) continue;
      const host = hostOf(url);
      found.push({ url, index: match.index, known: isKnownHost(host) });
    }

    BARE_URL_RE.lastIndex = 0;
    while ((match = BARE_URL_RE.exec(source))) {
      const url = coerceUrl(match[1]);
      if (!url) continue;
      const host = hostOf(url);
      found.push({
        url,
        index: match.index + match[0].length - match[1].length,
        known: isKnownHost(host),
      });
    }

    const seen = new Set();
    const unique = [];
    found.forEach((entry) => {
      if (seen.has(entry.url)) return;
      seen.add(entry.url);
      unique.push(entry);
    });
    unique.sort((a, b) => a.index - b.index);
    const known = unique.filter((entry) => entry.known);
    return known.length ? known : unique;
  }

  meta.normalizeUrl = function normalizeUrl(input) {
    return coerceUrl(input);
  };

  /**
   * Pull the most likely share link out of a noisy caption.
   * Prefers known platforms when the text contains several links.
   */
  meta.extractUrl = function extractUrl(text) {
    const candidates = collectCandidates(text);
    return candidates.length ? candidates[0].url : "";
  };

  meta.extractCandidates = function extractCandidates(text) {
    return collectCandidates(text).map((entry) => entry.url);
  };

  meta.stripUrls = function stripUrls(text) {
    return normalizeText(text)
      .replace(STRIP_URL_RE, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  meta.lookup = async function lookup(rawUrl) {
    const url = meta.extractUrl(rawUrl) || meta.normalizeUrl(rawUrl);
    if (!url) throw new Error("请输入有效的链接");
    const source = model.detectSource(url);
    const result = {
      url,
      source,
      title: "",
      author: "",
      cover: "",
      provider: "",
      ok: false,
    };

    // 2026-10-30 安全加固：不再向任何第三方服务（noembed.com）发送链接，保持纯离线。
    // 标题/作者/封面请在表单中手动填写；下方 hostname 回退逻辑保持不变。

    if (!result.title) {
      // A readable fallback that is clearly not an article title.
      try {
        const host = new URL(url).hostname.replace(/^www\./, "");
        result.title = "";
        result.provider = host;
      } catch (err) {
        /* ignore */
      }
    }
    return result;
  };

  meta.sourceHost = function sourceHost(rawUrl) {
    try {
      return new URL(meta.extractUrl(rawUrl) || rawUrl).hostname.replace(/^www\./, "");
    } catch (err) {
      return "";
    }
  };

  meta.isProbablyImage = function isProbablyImage(url) {
    return /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(String(url || ""));
  };

  function extractDate(text) {
    const match = String(text || "").match(/(20\d{2})[-./年](\d{1,2})[-./月](\d{1,2})/);
    if (!match) return { title: text, likedAt: "" };
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    if (isNaN(date.getTime())) return { title: text, likedAt: "" };
    return {
      title: text.replace(match[0], "").trim(),
      likedAt: date.toISOString(),
    };
  }

  function parseJsonImport(text) {
    if (!/^\s*[\[{]/.test(text)) return null;
    try {
      const data = JSON.parse(text);
      const list = Array.isArray(data) ? data : data.items;
      if (!Array.isArray(list)) return null;
      const items = [];
      list.forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        const url = meta.extractUrl(entry.url || entry.link || entry.href);
        if (!url) return;
        items.push({
          url,
          title: String(entry.title || entry.name || "").trim(),
          author: String(entry.author || entry.author_name || entry.uploader || "").trim(),
          cover: String(entry.cover || entry.thumbnail_url || entry.pic || "").trim(),
          duration: String(entry.duration || "").trim(),
          summary: String(entry.summary || entry.desc || "").trim(),
          likedAt: entry.likedAt || entry.liked_at || "",
          source: model.detectSource(url),
        });
      });
      return items;
    } catch (err) {
      return null;
    }
  }

  /**
   * Accepts one-link-per-line text, optionally "标题 | URL", or a JSON array
   * produced by the collector bookmarklet.
   */
  meta.parseBulk = function parseBulk(text) {
    const raw = String(text || "").trim();
    if (!raw) return { items: [], duplicates: 0, invalid: 0 };
    const jsonItems = parseJsonImport(raw);
    const entries = jsonItems || raw.split(/\r?\n/);
    const seen = new Set();
    let duplicates = 0;
    let invalid = 0;
    const items = [];

    entries.forEach((entry) => {
      let url = "";
      let title = "";
      let author = "";
      let cover = "";
      let likedAt = "";

      if (typeof entry === "string") {
        const line = entry.trim();
        if (!line) return;
        url = meta.extractUrl(line);
        if (!url) {
          invalid += 1;
          return;
        }
        title = meta
          .stripUrls(line)
          .replace(/^[\s|｜·•—–\-:：]+|[\s|｜·•—–\-:：]+$/g, "")
          .trim();
        const dated = extractDate(title);
        title = dated.title.replace(/^[\s|｜·•—–\-:：]+|[\s|｜·•—–\-:：]+$/g, "").trim();
        likedAt = dated.likedAt;
      } else {
        url = meta.extractUrl(entry.url) || meta.normalizeUrl(entry.url);
        title = entry.title || "";
        author = entry.author || "";
        cover = entry.cover || "";
        likedAt = entry.likedAt || entry.liked_at || "";
      }

      url = meta.normalizeUrl(url);
      if (!url) {
        invalid += 1;
        return;
      }
      if (seen.has(url)) {
        duplicates += 1;
        return;
      }
      seen.add(url);
      items.push({
        url,
        title: title,
        author: author,
        cover: cover,
        likedAt: likedAt,
        source: model.detectSource(url),
      });
    });

    return { items, duplicates, invalid };
  };

  meta.bookmarklet = function bookmarklet(baseUrl) {
    const appUrl = String(baseUrl || location.href).split("#")[0];
    const code = `(function(){
      var seen={},out=[];
      document.querySelectorAll('a[href]').forEach(function(a){
        var h=a.href;
        if(!/^https?:\\/\\//.test(h))return;
        if(!/(bilibili\\.com\\/video|xiaohongshu\\.com\\/explore|zhihu\\.com\\/question|mp\\.weixin\\.qq\\.com|douyin\\.com\\/video|youtube\\.com\\/watch)/.test(h))return;
        if(seen[h])return;seen[h]=1;
        var box=a.closest('li,article,section,div');
        var img=box?box.querySelector('img'):null;
        var t=(a.getAttribute('title')||a.textContent||'').replace(/\\s+/g,' ').trim();
        if(t.length<4&&img)t=(img.alt||'').trim();
        if(t.length<4)return;
        out.push({title:t.slice(0,160),url:h,cover:img?img.src:''});
      });
      var text=JSON.stringify(out,null,2);
      if(navigator.clipboard){navigator.clipboard.writeText(text)}else{
        var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
      }
      alert('已抓取 '+out.length+' 条内容，回到「思之流」粘贴即可。');
    })();`;
    return "javascript:" + encodeURIComponent(code);
  };
})();
