#!/usr/bin/env node
/**
 * 思之流 · 本地静态服务器
 * 零依赖，仅监听 127.0.0.1。用于让「选择数据文件夹」等浏览器能力可用。
 */
import http from "node:http";
import path from "node:path";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const HOST = "127.0.0.1";
const START_PORT = Number(process.env.PORT || 8787);
const OPEN = !process.argv.includes("--no-open");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

function safePath(urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(urlPath);
  } catch (err) {
    pathname = "/";
  }
  if (pathname.endsWith("/")) pathname += "index.html";
  const rel = path.normalize(pathname).replace(/^([/\\])+/, "");
  const resolved = path.resolve(ROOT, rel);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) return null;
  return resolved;
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end("Method Not Allowed");
    return;
  }

  const url = new URL(req.url || "/", "http://" + HOST);
  const filePath = safePath(url.pathname);
  if (!filePath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) {
      res.writeHead(302, { Location: url.pathname.replace(/\/?$/, "/") });
      res.end();
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(filePath).pipe(res);
  } catch (err) {
    const notFound = err && (err.code === "ENOENT" || err.code === "ENOTDIR");
    res.writeHead(notFound ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(notFound ? "Not Found" : "Internal Server Error");
  }
});

function openBrowser(address) {
  if (!OPEN) return;
  const command =
    process.platform === "win32"
      ? `start "" "${address}"`
      : process.platform === "darwin"
      ? `open "${address}"`
      : `xdg-open "${address}"`;
  exec(command, () => {});
}

function listen(port, attempt = 0) {
  server.once("error", (err) => {
    if (err && err.code === "EADDRINUSE" && attempt < 12) {
      listen(port + 1, attempt + 1);
    } else {
      console.error("无法启动本地服务器：", err);
      process.exit(1);
    }
  });

  server.listen(port, HOST, () => {
    const address = `http://${HOST}:${port}/`;
    console.log("");
    console.log("  思之流 · Stream of Thought");
    console.log("  " + address);
    console.log("");
    console.log("  数据保存在本机；关闭这个窗口即停止服务。");
    console.log("  如果浏览器没有自动打开，请手动访问上面的地址。");
    console.log("");
    openBrowser(address);
  });
}

listen(START_PORT);
