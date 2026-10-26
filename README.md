# 天地图在线坐标拾取系统 (完整还原项目)

基于源打包代码结构还原：采用 **Vue 3 + Mapbox GL JS 2.15.0 + 天地图 WMTS 切片服务** 开发的在线经纬度拾取与转换工具。

## 项目特点
1. **天地图底图服务**: 支持天地图矢量地图（`vec` + `cva`）与卫星影像（`img` + `cia`）无缝切换。
2. **多子域并发加载**: 采用 `t0` ~ `t7` 多子域轮询加载切片，突破浏览器单域名并发请求限制。
3. **坐标系统集成**: 支持 WGS-84（原始 GPS / 天地图）、GCJ-02（火星坐标系 / 高德 / 腾讯）、BD-09（百度地图）实时换算与一键复制。
4. **交互体验**: 支持地图点击拾取、图钉拖拽微调定位、输入经纬度精确定位。

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
- `VITE_MAPBOX_TOKEN`：在 [Mapbox](https://account.mapbox.com/access-tokens/) 获取的 Access Token

> 这两个 Token 会随前端产物公开，请务必在服务方控制台配置域名/URL 白名单。

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
