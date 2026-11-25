# 天地图在线坐标拾取系统

采用 **Vue 3 + MapLibre GL JS + 天地图 WMTS 切片服务** 开发的在线经纬度拾取与转换工具。

## 项目特点
1. **天地图底图与二三维切换**: 支持天地图矢量地图（`vec` + `cva`）与卫星影像（`img` + `cia`）切换，支持 2D 平面（Mercator）与 3D 地球（Globe）模式切换。
2. **多子域并发加载**: 采用 `t0` ~ `t7` 多子域轮询加载切片，突破浏览器单域名并发请求限制。
3. **多点拾取与多坐标系表格**: 支持持续点击地图添加多点、标绘拖拽微调、坐标定位与 POI 关键字搜索；右侧表格展示天地图（CGCS2000）、高德（GCJ-02）、百度（BD-09）坐标，支持单坐标一键复制、单点定位/移除与导出 CSV。

## 运行步骤

1. 安装依赖：
```bash
npm install
```

2. 配置环境变量：
仓库已提交 `.env`（含浏览器端 Token），拉取代码后可直接运行。

如需改用自己申请的 Token，复制 `.env.example` 为 `.env.local` 并填写（`.env.local` 优先级更高，且不会提交）：

```bash
cp .env.example .env.local
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
