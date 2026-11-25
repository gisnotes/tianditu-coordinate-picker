# 天地图在线坐标拾取系统

采用 **Vue 3 + MapLibre GL JS + 天地图 WMTS 切片服务** 开发的在线经纬度拾取与转换工具。

## 项目特点
1. **天地图底图与二三维切换**: 支持天地图矢量地图（`vec` + `cva`）与卫星影像（`img` + `cia`）切换，支持 2D 平面（Mercator）与 3D 地球（Globe）模式切换（3D 视图自动切换为立体图钉标绘，左下角提供可折叠数据源标识）。
2. **多子域并发加载**: 采用 `t0` ~ `t7` 多子域轮询加载切片，突破浏览器单域名并发请求限制。
3. **多点拾取与多坐标系表格**: 支持持续点击地图添加多点、标绘拖拽微调、坐标定位与 POI 关键字搜索；右侧可折叠表格展示天地图（CGCS2000）、高德（GCJ-02）、百度（BD-09）坐标，支持单坐标一键复制、单点定位/移除与导出 CSV。
4. **在线更换天地图密钥**: 支持在页面顶栏直接点击「密钥更改」输入自定义天地图浏览器端 Key，自动持久化至浏览器 `localStorage` 并刷新地图瓦片，同时支持一键恢复默认密钥。

## 运行步骤

1. 安装依赖：
```bash
npm install
```

2. 配置环境变量（可选）：
仓库已提交 `.env`（含默认浏览器端 Token），**在其它设备克隆/下载仓库后无需补建 `.env.local` 即可直接运行**。

密钥读取优先级为：**页面顶部「密钥更改」（`localStorage`） > `.env.local`（本地覆盖） > `.env`（仓库默认）**。

如需改用自己申请的 Token，可通过以下任意一种方式：
- **方式一（推荐，零文件配置）**：启动或访问页面后，直接点击顶部「密钥更改」按钮在线填写并应用（保存于本地浏览器 `localStorage`，支持随时一键恢复默认）。
- **方式二（本地文件覆盖，不提交仓库）**：`.env.local` 已被 `.gitignore` 忽略，如需在本地长期使用个人密钥，可从 `.env.example` 复制一份并填写：

```bash
# macOS / Linux / Git Bash
cp .env.example .env.local
# Windows PowerShell
Copy-Item .env.example .env.local
```
- `VITE_TDT_KEY`：在[天地图控制台](https://console.tianditu.gov.cn/)申请的「浏览器端」Token，需开通底图服务与地名搜索服务，并配置域名白名单

> 该 Token 会随前端产物公开，请务必在天地图控制台配置域名/URL 白名单。

3. 启动本地开发服务：
```bash
npm run dev
```

4. 构建打包：
```bash
npm run build
```

5. 部署到 GitHub Pages：
```bash
npm run deploy
```
