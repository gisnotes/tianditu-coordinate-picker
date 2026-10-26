<template>
  <div class="coordinate-picker-app">
    <!-- 顶部操作栏 -->
    <header class="app-header">
      <div class="header-left">
        <div class="brand">
          <el-icon class="brand-icon" :size="22"><MapLocation /></el-icon>
          <span class="title">天地图在线坐标拾取系统</span>
        </div>
        <div class="header-links">
          <el-link
            type="primary"
            :underline="false"
            href="https://lbs.amap.com/tools/picker"
            target="_blank"
            rel="noopener noreferrer"
          >高德坐标拾取</el-link>
          <el-link
            type="success"
            :underline="false"
            href="https://api.map.baidu.com/lbsapi/getpoint/index.html"
            target="_blank"
            rel="noopener noreferrer"
          >百度坐标拾取</el-link>
        </div>
      </div>
      <div class="search-panel-wrap">
        <div class="search-toolbar">
          <el-radio-group v-model="searchMode" @change="handleModeChange">
            <el-radio-button value="coord">坐标定位</el-radio-button>
            <el-radio-button value="poi">POI 搜索</el-radio-button>
          </el-radio-group>

          <el-input
            v-model="searchKeyword"
            class="search-input"
            :placeholder="searchMode === 'coord' ? '输入经度,纬度跳转 (例: 116.4074, 39.9042)' : '输入关键字搜索地点 (例: 故宫)'"
            clearable
            @keyup.enter="handleSearch"
          />

          <el-button
            type="primary"
            :loading="searchMode === 'poi' && poiLoading"
            @click="handleSearch"
          >{{ searchMode === 'coord' ? '定位' : '搜索' }}</el-button>
        </div>

        <!-- POI 搜索结果下拉面板 -->
        <div v-if="searchMode === 'poi' && (poiLoading || poiError || poiSearched)" class="poi-results">
          <div class="poi-results-header">
            <span>{{ poiLoading ? '搜索中...' : (poiError ? '搜索失败' : `搜索结果（${poiResults.length}）`) }}</span>
            <el-button link :icon="Close" @click="clearPoiResults" />
          </div>
          <el-alert
            v-if="poiError"
            class="poi-alert"
            :title="poiError"
            type="error"
            :closable="false"
            show-icon
          />
          <el-empty
            v-else-if="!poiLoading && !poiResults.length"
            class="poi-empty"
            description="未找到相关地点"
            :image-size="60"
          />
          <el-scrollbar v-if="poiResults.length" max-height="400px">
            <ul ref="poiListRef" class="poi-list">
              <li
                v-for="(poi, index) in poiResults"
                :key="poi.id"
                class="poi-item"
                :class="{ active: activePoiId === poi.id }"
                @click="selectPoi(poi)"
              >
                <span class="poi-index">{{ index + 1 }}</span>
                <div class="poi-info">
                  <div class="poi-name">{{ poi.name }}</div>
                  <div class="poi-address">{{ poi.address || poi.typeName || '暂无地址信息' }}</div>
                </div>
              </li>
            </ul>
          </el-scrollbar>
        </div>
      </div>
    </header>

    <!-- 地图容器主体 -->
    <div class="map-wrapper">
      <div ref="mapContainer" class="map-view"></div>

      <!-- 右上角底图切换器（仿 Google Maps：缩略图按钮 + 展开面板） -->
      <div class="layer-switcher">
        <transition name="layer-panel">
          <div v-if="layerPanelOpen" class="layer-panel">
            <div
              class="layer-option"
              :class="{ active: currentLayer === 'vec' }"
              @click="chooseLayer('vec')"
            >
              <div class="layer-preview vec-thumb">
                <span class="layer-preview-name">矢量地图</span>
              </div>
              <span class="layer-label">矢量地图</span>
            </div>
            <div
              class="layer-option"
              :class="{ active: currentLayer === 'img' }"
              @click="chooseLayer('img')"
            >
              <div class="layer-preview img-thumb">
                <span class="layer-preview-name">卫星影像</span>
              </div>
              <span class="layer-label">卫星影像</span>
            </div>
          </div>
        </transition>
        <button
          class="layer-toggle"
          type="button"
          title="切换底图"
          @click="layerPanelOpen = !layerPanelOpen"
        >
          <span class="layer-toggle-thumb" :class="currentLayer === 'vec' ? 'vec-thumb' : 'img-thumb'"></span>
          <el-icon class="layer-toggle-icon"><Files /></el-icon>
        </button>
      </div>

      <!-- 浮动坐标拾取面板 -->
      <div v-if="pickedCoord" class="coord-card">
        <div class="card-header">
          <span class="card-title">
            <el-icon><Aim /></el-icon>
            当前拾取坐标
          </span>
          <el-button link :icon="Close" @click="pickedCoord = null" />
        </div>
        <div class="coord-group">
          <div class="coord-item">
            <span class="label">WGS-84 (CGCS2000):</span>
            <span class="value">{{ pickedCoord.lng.toFixed(6) }}, {{ pickedCoord.lat.toFixed(6) }}</span>
            <el-button size="small" @click="copyText(`${pickedCoord.lng.toFixed(6)}, ${pickedCoord.lat.toFixed(6)}`)">复制</el-button>
          </div>
          <div class="coord-item">
            <span class="label">GCJ-02 (高德/腾讯):</span>
            <span class="value">{{ gcjCoord[0].toFixed(6) }}, {{ gcjCoord[1].toFixed(6) }}</span>
            <el-button size="small" @click="copyText(`${gcjCoord[0].toFixed(6)}, ${gcjCoord[1].toFixed(6)}`)">复制</el-button>
          </div>
          <div class="coord-item">
            <span class="label">BD-09 (百度地图):</span>
            <span class="value">{{ bdCoord[0].toFixed(6) }}, {{ bdCoord[1].toFixed(6) }}</span>
            <el-button size="small" @click="copyText(`${bdCoord[0].toFixed(6)}, ${bdCoord[1].toFixed(6)}`)">复制</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import mapboxgl from 'mapbox-gl'
import { Aim, Close, Files, MapLocation } from '@element-plus/icons-vue'
import { wgs84ToGcj02, wgs84ToBd09 } from './utils/coordTransform'

// Mapbox Access Token（通过 .env.local 中的 VITE_MAPBOX_TOKEN 配置）
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const mapContainer = ref(null)
const currentLayer = ref('vec')
const layerPanelOpen = ref(false)
const pickedCoord = ref({ lng: 116.4074, lat: 39.9042 })

// 搜索方式：coord = 经纬度定位，poi = 关键字搜索
const searchMode = ref('coord')
const coordQuery = ref('')
const poiQuery = ref('')
const poiResults = ref([])
const poiLoading = ref(false)
const poiError = ref('')
const poiSearched = ref(false)
const activePoiId = ref('')
const poiListRef = ref(null)

// 根据当前模式复用同一个输入框
const searchKeyword = computed({
  get: () => (searchMode.value === 'coord' ? coordQuery.value : poiQuery.value),
  set: (val) => {
    if (searchMode.value === 'coord') coordQuery.value = val
    else poiQuery.value = val
  }
})

let map = null
let marker = null
let poiMarkers = []

// 天地图服务端 Token (tk)，通过 .env.local 中的 VITE_TDT_KEY 配置
// 注意：需在国家地理信息公共服务平台 (https://console.tianditu.gov.cn/) 申请「浏览器端」Token
const TDT_KEY = import.meta.env.VITE_TDT_KEY

// 天地图官方版权与审图号信息
const TDT_ATTRIBUTION = '数据来源：自然资源部 & NavInfo　审图号：GS（2026）4921号'

// 生成天地图多子域并发瓦片 URL 列表
function getTdtUrls(type) {
  const subdomains = ['0', '1', '2', '3', '4', '5', '6', '7']
  return subdomains.map(
    s => `https://t${s}.tianditu.gov.cn/${type}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${type}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TDT_KEY}`
  )
}

// 转换其它坐标系展示
const gcjCoord = computed(() => {
  if (!pickedCoord.value) return [0, 0]
  return wgs84ToGcj02(pickedCoord.value.lng, pickedCoord.value.lat)
})

const bdCoord = computed(() => {
  if (!pickedCoord.value) return [0, 0]
  return wgs84ToBd09(pickedCoord.value.lng, pickedCoord.value.lat)
})

// 创建底图样式规范对象
function createMapStyle() {
  return {
    version: 8,
    sources: {
      'tdt-vec': {
        type: 'raster',
        tiles: getTdtUrls('vec'),
        tileSize: 256,
        attribution: TDT_ATTRIBUTION
      },
      'tdt-cva': {
        type: 'raster',
        tiles: getTdtUrls('cva'),
        tileSize: 256,
        attribution: TDT_ATTRIBUTION
      },
      'tdt-img': {
        type: 'raster',
        tiles: getTdtUrls('img'),
        tileSize: 256,
        attribution: TDT_ATTRIBUTION
      },
      'tdt-cia': {
        type: 'raster',
        tiles: getTdtUrls('cia'),
        tileSize: 256,
        attribution: TDT_ATTRIBUTION
      }
    },
    layers: [
      {
        id: 'layer-tdt-vec',
        type: 'raster',
        source: 'tdt-vec',
        minzoom: 0,
        maxzoom: 18,
        layout: { visibility: 'visible' }
      },
      {
        id: 'layer-tdt-cva',
        type: 'raster',
        source: 'tdt-cva',
        minzoom: 0,
        maxzoom: 18,
        layout: { visibility: 'visible' }
      },
      {
        id: 'layer-tdt-img',
        type: 'raster',
        source: 'tdt-img',
        minzoom: 0,
        maxzoom: 18,
        layout: { visibility: 'none' }
      },
      {
        id: 'layer-tdt-cia',
        type: 'raster',
        source: 'tdt-cia',
        minzoom: 0,
        maxzoom: 18,
        layout: { visibility: 'none' }
      }
    ]
  }
}

// 切换底图（矢量与影像）
function switchBaseLayer(targetType) {
  if (currentLayer.value === targetType || !map) return
  currentLayer.value = targetType

  const isVec = targetType === 'vec'
  map.setLayoutProperty('layer-tdt-vec', 'visibility', isVec ? 'visible' : 'none')
  map.setLayoutProperty('layer-tdt-cva', 'visibility', isVec ? 'visible' : 'none')
  map.setLayoutProperty('layer-tdt-img', 'visibility', isVec ? 'none' : 'visible')
  map.setLayoutProperty('layer-tdt-cia', 'visibility', isVec ? 'none' : 'visible')
}

// 选择底图并收起切换面板
function chooseLayer(type) {
  switchBaseLayer(type)
  layerPanelOpen.value = false
}

// 拾取与标点定位
function setCoord(lng, lat) {
  pickedCoord.value = { lng, lat }
  if (!marker) {
    marker = new mapboxgl.Marker({ color: '#ff4d4f', draggable: true })
      .setLngLat([lng, lat])
      .addTo(map)

    marker.on('dragend', () => {
      const pos = marker.getLngLat()
      pickedCoord.value = { lng: pos.lng, lat: pos.lat }
    })
  } else {
    marker.setLngLat([lng, lat])
  }
}

// 手动输入经纬度跳转
function handleJump() {
  if (!coordQuery.value.trim()) return
  const parts = coordQuery.value.split(/[,，\s]+/).map(Number)
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const [lng, lat] = parts
    setCoord(lng, lat)
    map.flyTo({ center: [lng, lat], zoom: 14 })
  } else {
    alert('请输入正确的格式，例如：116.4074, 39.9042')
  }
}

// 搜索入口：按当前模式分发
function handleSearch() {
  if (searchMode.value === 'coord') handleJump()
  else searchPoi()
}

// 切换搜索方式，退出 POI 模式时清除结果与标注
function handleModeChange(mode) {
  if (mode === 'coord') clearPoiResults()
}

// 天地图地名搜索服务 (V2.0)
const TDT_SEARCH_URL = 'https://api.tianditu.gov.cn/v2/search'

// 取当前地图视野范围作为检索范围
function getMapBound() {
  const b = map.getBounds()
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
    .map(n => n.toFixed(6))
    .join(',')
}

function clearPoiMarkers() {
  poiMarkers.forEach(m => m.remove())
  poiMarkers = []
}

function clearPoiResults() {
  clearPoiMarkers()
  poiResults.value = []
  poiError.value = ''
  poiSearched.value = false
  activePoiId.value = ''
}

// POI 关键字搜索
async function searchPoi() {
  const keyword = poiQuery.value.trim()
  if (!keyword || poiLoading.value) return

  clearPoiMarkers()
  poiResults.value = []
  activePoiId.value = ''
  poiError.value = ''
  poiSearched.value = true
  poiLoading.value = true

  const postStr = {
    keyWord: keyword,
    level: Math.min(Math.max(Math.round(map.getZoom()), 1), 18),
    mapBound: getMapBound(),
    queryType: 1,
    start: 0,
    count: 20
  }
  const url = `${TDT_SEARCH_URL}?postStr=${encodeURIComponent(JSON.stringify(postStr))}&type=query&tk=${TDT_KEY}`

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`请求失败（HTTP ${res.status}）`)
    const data = await res.json()
    if (data.status?.infocode !== 1000 && !Array.isArray(data.pois)) {
      throw new Error(data.status?.cndesc || data.msg || '天地图搜索服务返回异常')
    }

    poiResults.value = (data.pois || [])
      .map((item, index) => {
        const [lng, lat] = String(item.lonlat || '').split(',').map(Number)
        return {
          id: item.poiId || `${index}-${item.name}`,
          name: item.name,
          address: item.address,
          typeName: item.typeName,
          lng,
          lat
        }
      })
      .filter(poi => Number.isFinite(poi.lng) && Number.isFinite(poi.lat))

    addPoiMarkers()
  } catch (e) {
    poiError.value = '搜索失败：' + (e.message || '请检查网络或天地图 Token 配置')
  } finally {
    poiLoading.value = false
  }
}

// 在结果位置添加带序号的蓝色标注
function addPoiMarkers() {
  poiResults.value.forEach((poi, index) => {
    const el = document.createElement('div')
    el.className = 'poi-marker'
    el.dataset.poiId = poi.id
    el.textContent = String(index + 1)
    el.addEventListener('click', evt => {
      evt.stopPropagation()
      selectPoi(poi)
    })

    poiMarkers.push(
      new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([poi.lng, poi.lat])
        .addTo(map)
    )
  })
}

// 选中搜索结果：定位并同步拾取坐标
function selectPoi(poi) {
  activePoiId.value = poi.id
  updateActivePoiMarker()
  scrollActivePoiIntoView()
  setCoord(poi.lng, poi.lat)
  map.flyTo({ center: [poi.lng, poi.lat], zoom: Math.max(map.getZoom(), 15) })
}

// 若选中项不在下拉框可视区域内，则滚动到该项
function scrollActivePoiIntoView() {
  nextTick(() => {
    poiListRef.value
      ?.querySelector('.poi-item.active')
      ?.scrollIntoView({ block: 'nearest' })
  })
}

// 同步标注选中态（放大、变红并置于顶层）
function updateActivePoiMarker() {
  poiMarkers.forEach(m => {
    const el = m.getElement()
    const isActive = el.dataset.poiId === activePoiId.value
    el.classList.toggle('active', isActive)
    el.style.zIndex = isActive ? '10' : ''
  })
}

// 复制坐标
function copyText(val) {
  navigator.clipboard.writeText(val).then(() => {
    alert('已复制坐标：' + val)
  })
}

onMounted(() => {
  map = new mapboxgl.Map({
    container: mapContainer.value,
    style: createMapStyle(),
    center: [116.4074, 39.9042],
    zoom: 11,
    minZoom: 1,
    maxZoom: 18,
    attributionControl: false
  })

  map.addControl(new mapboxgl.NavigationControl(), 'top-left')

  // 版权信息：左下角展示天地图官方数据来源与审图号（由各数据源 attribution 汇总）
  // 需先于比例尺添加，保证版权条贴在最底部，比例尺位于其上方
  map.addControl(new mapboxgl.AttributionControl({ compact: false }), 'bottom-left')
  map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left')

  // 初始化默认点
  setCoord(116.4074, 39.9042)

  // 点击地图拾取坐标
  map.on('click', (e) => {
    layerPanelOpen.value = false
    setCoord(e.lngLat.lng, e.lngLat.lat)
  })
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<style scoped>
.coordinate-picker-app {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
}

.app-header {
  height: 54px;
  background: #ffffff;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 600;
  color: #1f1f1f;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-links {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-left: 40px;
}

.header-links :deep(.el-link) {
  font-size: 13px;
}

.brand-icon {
  color: #1890ff;
}

.search-panel-wrap {
  position: relative;
}

.search-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-input {
  width: 360px;
}

.poi-results {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 430px;
  max-height: 460px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 20;
}

.poi-results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #262626;
  border-bottom: 1px solid #f0f0f0;
}

.poi-alert {
  width: auto;
  margin: 10px;
}

.poi-empty {
  padding: 12px 0;
}

.poi-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.poi-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
}

.poi-item:hover {
  background: #f5faff;
}

.poi-item.active {
  background: #e6f4ff;
}

.poi-index {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  border-radius: 50%;
  background: #1890ff;
  color: #ffffff;
  font-size: 12px;
}

.poi-info {
  flex: 1;
  min-width: 0;
}

.poi-name {
  font-size: 13px;
  color: #262626;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.poi-address {
  margin-top: 2px;
  font-size: 12px;
  color: #8c8c8c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.map-wrapper {
  flex: 1;
  position: relative;
}

.map-view {
  width: 100%;
  height: 100%;
}

.layer-switcher {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 5;
}

/* 收缩态：仿 Google Maps 的方形缩略图按钮 */
.layer-toggle {
  position: relative;
  width: 56px;
  height: 56px;
  padding: 0;
  border: 2px solid #ffffff;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.2s ease;
}

.layer-toggle:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.layer-toggle-thumb {
  position: absolute;
  inset: 0;
  background-size: cover;
}

.layer-toggle-icon {
  position: absolute;
  right: 3px;
  bottom: 3px;
  font-size: 15px;
  color: #ffffff;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.75));
}

/* 展开态：缩略图选项卡面板 */
.layer-panel {
  position: absolute;
  top: 0;
  right: 64px;
  display: flex;
  gap: 10px;
  padding: 10px;
  background: #ffffff;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
}

.layer-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.layer-preview {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 6px;
  border: 2px solid transparent;
  background-size: cover;
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.layer-preview-name {
  position: absolute;
  top: 4px;
  left: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}

.layer-label {
  font-size: 12px;
  color: #5f6368;
}

.layer-option.active .layer-preview {
  border-color: #1a73e8;
}

.layer-option.active .layer-label {
  color: #1a73e8;
  font-weight: 600;
}

.layer-panel-enter-active,
.layer-panel-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.layer-panel-enter-from,
.layer-panel-leave-to {
  opacity: 0;
  transform: translateX(6px);
}

/* 底图缩略图（纯 CSS 近似效果） */
.vec-thumb {
  background-color: #e6f4ff;
  background-image: linear-gradient(135deg, #cbe3fb 25%, #e1effe 25%, #e1effe 50%, #cbe3fb 50%, #cbe3fb 75%, #e1effe 75%, #e1effe 100%);
}

.img-thumb {
  background-color: #132238;
  background-image: linear-gradient(135deg, #1b382b 25%, #264a39 25%, #264a39 50%, #1b382b 50%, #1b382b 75%, #264a39 75%, #264a39 100%);
}

.coord-card {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 380px;
  background: #ffffff;
  padding: 12px;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
  z-index: 5;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: #262626;
}

.coord-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.coord-item {
  display: flex;
  align-items: center;
  font-size: 13px;
  justify-content: space-between;
}

.coord-item .label {
  color: #595959;
  width: 135px;
}

.coord-item .value {
  color: #262626;
  font-family: monospace;
  font-size: 13px;
  flex: 1;
}
</style>

<style>
/* 左下角控件（比例尺、版权信息）贴左侧 8px、底部 8px */
.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl {
  float: none;
  margin: 0 0 8px 8px !important;
}

/* 版权栏背景透明度与比例尺一致 */
.mapboxgl-ctrl.mapboxgl-ctrl-attrib {
  background-color: hsla(0, 0%, 100%, 0.75);
}

/* 隐藏 Mapbox 默认 logo（保留左下角版权信息） */
.mapboxgl-ctrl-logo {
  display: none !important;
}

/* POI 结果标注由 JS 动态创建，需使用全局样式 */
.poi-marker {
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  border-radius: 50%;
  background: #1890ff;
  border: 2px solid #ffffff;
  color: #ffffff;
  font-size: 11px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  transition: width 0.15s ease, height 0.15s ease, line-height 0.15s ease,
    background-color 0.15s ease, box-shadow 0.15s ease;
}

/* 选中的 POI 标注：放大并变红 */
.poi-marker.active {
  width: 30px;
  height: 30px;
  line-height: 30px;
  border-width: 3px;
  background: #ff4d4f;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(255, 77, 79, 0.6);
}
</style>

