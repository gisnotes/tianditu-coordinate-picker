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
      <div class="header-right">
        <!-- 更改天地图密钥 -->
        <div ref="tkChangeRef" class="tk-change">
          <button
            type="button"
            class="tk-trigger"
            :class="{ active: tkPopoverOpen, custom: hasCustomTdtKey }"
            title="天地图密钥更改"
            @click="toggleTkPopover"
          >
            <el-icon><Key /></el-icon>
            <span>密钥更改</span>
            <span v-if="hasCustomTdtKey" class="tk-dot" title="当前使用自定义密钥"></span>
          </button>
          <transition name="el-zoom-in-top">
            <div v-show="tkPopoverOpen" class="tk-popover">
              <div class="popover-header">
                <span class="popover-title">天地图密钥更改</span>
                <button
                  type="button"
                  class="popover-close"
                  title="关闭"
                  @click="tkPopoverOpen = false"
                >
                  <el-icon><Close /></el-icon>
                </button>
              </div>
              <div class="popover-form">
                <el-input
                  ref="tkInputRef"
                  v-model="tkInput"
                  size="small"
                  placeholder="请输入新的天地图密钥"
                  clearable
                  @keyup.enter="applyTdtKey"
                >
                  <template #prefix>
                    <el-icon><Key /></el-icon>
                  </template>
                </el-input>
                <el-button
                  type="primary"
                  size="small"
                  :disabled="!tkInput.trim()"
                  @click="applyTdtKey"
                >应用</el-button>
              </div>
              <div class="popover-footer">
                <span class="popover-hint">输入新密钥后将自动刷新地图瓦片</span>
                <el-button
                  v-if="hasCustomTdtKey"
                  link
                  type="primary"
                  size="small"
                  @click="resetTdtKey"
                >恢复默认</el-button>
              </div>
            </div>
          </transition>
        </div>

        <span class="header-divider"></span>

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
      </div>
    </header>

    <!-- 主体区域：左侧地图 + 右侧多点坐标表格栏 -->
    <div class="main-body">
      <div class="map-wrapper">
        <div ref="mapContainer" class="map-view" :class="{ 'is-3d': viewMode === '3d' }"></div>

        <!-- 右下角垂直圆形悬浮工具栏：2D/3D 切换 & 底图切换 -->
        <div class="map-fab-controls">
          <el-tooltip
            :content="viewMode === '2d' ? '切换为 3D 地球视图' : '切换为 2D 平面视图'"
            placement="left"
          >
            <el-button
              circle
              type="primary"
              :plain="viewMode === '2d'"
              class="map-fab-btn"
              @click="toggleViewMode"
            >{{ viewMode === '2d' ? '3D' : '2D' }}</el-button>
          </el-tooltip>

          <el-tooltip
            :content="currentLayer === 'vec' ? '切换为卫星影像' : '切换为矢量地图'"
            placement="left"
          >
            <el-button
              circle
              type="primary"
              :plain="currentLayer === 'vec'"
              class="map-fab-btn"
              @click="toggleBaseLayer"
            >{{ currentLayer === 'vec' ? '影像' : '矢量' }}</el-button>
          </el-tooltip>
        </div>

        <!-- 侧边栏收起/展开把手 -->
        <button
          type="button"
          class="sidebar-toggle"
          :title="sidebarCollapsed ? '展开坐标面板' : '收起坐标面板'"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <el-icon :size="14">
            <ArrowLeft v-if="sidebarCollapsed" />
            <ArrowRight v-else />
          </el-icon>
        </button>
      </div>

      <!-- 右侧坐标拾取列表侧边栏 -->
      <aside class="coord-sidebar" :class="{ wide: showOtherCoords, collapsed: sidebarCollapsed }">
        <div class="sidebar-top">
          <el-input
            :model-value="activeCoordText"
            readonly
            placeholder="点击地图拾取坐标"
          >
            <template #append>
              <el-button :disabled="!activeCoordText" @click="copyText(activeCoordText)">复制</el-button>
            </template>
          </el-input>
        </div>

        <div class="sidebar-toolbar">
          <div class="toolbar-left">
            <el-checkbox v-model="showOtherCoords">显示高德/百度</el-checkbox>
            <span class="point-count">共 {{ pickedPoints.length }} 点</span>
          </div>
          <div class="toolbar-actions">
            <el-button
              type="primary"
              size="small"
              :icon="Download"
              :disabled="!pickedPoints.length"
              @click="handleExportCsv"
            >导出为 .csv</el-button>
            <el-button
              type="danger"
              plain
              size="small"
              :icon="Delete"
              :disabled="!pickedPoints.length"
              @click="clearAllPoints"
            >清空</el-button>
          </div>
        </div>

        <div class="sidebar-table">
          <el-table
            ref="tableRef"
            :data="pickedPoints"
            height="100%"
            stripe
            highlight-current-row
            row-key="id"
            empty-text="点击地图即可持续添加坐标点位"
            @row-click="row => setActivePoint(row.id)"
          >
            <el-table-column label="#" width="48" align="center">
              <template #default="{ $index }">{{ $index + 1 }}</template>
            </el-table-column>

            <el-table-column label="天地图(CGCS2000)" min-width="210">
              <template #default="{ row }">
                <div class="coord-cell">
                  <span class="coord-text">{{ formatCoord(row.lng, row.lat) }}</span>
                  <el-button
                    link
                    type="primary"
                    :icon="CopyDocument"
                    title="复制天地图坐标"
                    @click.stop="copyText(formatCoord(row.lng, row.lat))"
                  />
                </div>
              </template>
            </el-table-column>

            <el-table-column v-if="showOtherCoords" label="高德(GCJ-02)" min-width="210">
              <template #default="{ row }">
                <div class="coord-cell">
                  <span class="coord-text">{{ formatCoord(row.gcjLng, row.gcjLat) }}</span>
                  <el-button
                    link
                    type="primary"
                    :icon="CopyDocument"
                    title="复制高德坐标"
                    @click.stop="copyText(formatCoord(row.gcjLng, row.gcjLat))"
                  />
                </div>
              </template>
            </el-table-column>

            <el-table-column v-if="showOtherCoords" label="百度(BD-09)" min-width="210">
              <template #default="{ row }">
                <div class="coord-cell">
                  <span class="coord-text">{{ formatCoord(row.bdLng, row.bdLat) }}</span>
                  <el-button
                    link
                    type="primary"
                    :icon="CopyDocument"
                    title="复制百度坐标"
                    @click.stop="copyText(formatCoord(row.bdLng, row.bdLat))"
                  />
                </div>
              </template>
            </el-table-column>

            <el-table-column label="操作" width="110" fixed="right" align="center">
              <template #default="{ row }">
                <div class="op-actions">
                  <el-button type="primary" link @click.stop="locatePoint(row)">定位</el-button>
                  <el-button type="danger" link @click.stop="removePoint(row.id)">移除</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import * as maplibregl from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight, Close, CopyDocument, Delete, Download, Key, MapLocation } from '@element-plus/icons-vue'
import { wgs84ToGcj02, wgs84ToBd09 } from './utils/coordTransform'
import { exportPointsToCsv } from './utils/exportCsv'

maplibregl.setWorkerUrl(maplibreWorkerUrl)

const mapContainer = ref(null)
const viewMode = ref('2d')
const currentLayer = ref('vec')
const sidebarCollapsed = ref(false)
const pickedPoints = ref([])
const activePointId = ref(null)
const showOtherCoords = ref(false)
const tableRef = ref(null)

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
let nextPointId = 1
const pointMarkers = new Map()
let poiMarkers = []
let mapResizeObserver = null

// 天地图服务端 Token (tk)，优先使用浏览器端本地保存的自定义密钥，其次读取 VITE_TDT_KEY
// 注意：需在国家地理信息公共服务平台 (https://console.tianditu.gov.cn/) 申请「浏览器端」Token
const TDT_KEY_STORAGE_KEY = 'tdt_custom_key'
const DEFAULT_TDT_KEY = import.meta.env.VITE_TDT_KEY || ''

function getStoredTdtKey() {
  try {
    return (localStorage.getItem(TDT_KEY_STORAGE_KEY) || '').trim()
  } catch {
    return ''
  }
}

const savedTdtKey = getStoredTdtKey()
const hasCustomTdtKey = ref(Boolean(savedTdtKey))
const TDT_KEY = savedTdtKey || DEFAULT_TDT_KEY

// 天地图密钥更改浮层交互
const tkPopoverOpen = ref(false)
const tkChangeRef = ref(null)
const tkInputRef = ref(null)
const tkInput = ref('')

function toggleTkPopover() {
  tkPopoverOpen.value = !tkPopoverOpen.value
  if (tkPopoverOpen.value) {
    nextTick(() => {
      tkInputRef.value?.focus()
    })
  }
}

function applyTdtKey() {
  const trimmed = tkInput.value.trim()
  if (!trimmed) return
  try {
    localStorage.setItem(TDT_KEY_STORAGE_KEY, trimmed)
  } catch {
    ElMessage.error('无法写入浏览器本地存储，请检查浏览器隐私设置')
    return
  }
  hasCustomTdtKey.value = true
  tkInput.value = ''
  tkPopoverOpen.value = false
  ElMessage({
    message: '天地图密钥已更换，即将刷新地图',
    type: 'primary',
    plain: true,
    duration: 1500,
    onClose: () => window.location.reload()
  })
}

function resetTdtKey() {
  try {
    localStorage.removeItem(TDT_KEY_STORAGE_KEY)
  } catch {
    // 忽略存储清理异常
  }
  hasCustomTdtKey.value = false
  tkInput.value = ''
  tkPopoverOpen.value = false
  ElMessage({
    message: '已恢复默认天地图密钥，即将刷新地图',
    type: 'primary',
    plain: true,
    duration: 1500,
    onClose: () => window.location.reload()
  })
}

function handleTkOutsideClick(e) {
  if (tkPopoverOpen.value && !tkChangeRef.value?.contains(e.target)) {
    tkPopoverOpen.value = false
  }
}

// 天地图官方版权与审图号信息
const TDT_ATTRIBUTION = '数据来源：自然资源部 & NavInfo　审图号：GS（2026）4921号'

// 生成天地图多子域并发瓦片 URL 列表
function getTdtUrls(type) {
  const subdomains = ['0', '1', '2', '3', '4', '5', '6', '7']
  return subdomains.map(
    s => `https://t${s}.tianditu.gov.cn/${type}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${type}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TDT_KEY}`
  )
}

function formatCoord(lng, lat) {
  return `${lng.toFixed(6)}, ${lat.toFixed(6)}`
}

const activePoint = computed(() => {
  return pickedPoints.value.find(p => p.id === activePointId.value) || null
})

const activeCoordText = computed(() => {
  if (!activePoint.value) return ''
  return formatCoord(activePoint.value.lng, activePoint.value.lat)
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
  if (!map) return
  currentLayer.value = targetType

  const isVec = targetType === 'vec'
  map.setLayoutProperty('layer-tdt-vec', 'visibility', isVec ? 'visible' : 'none')
  map.setLayoutProperty('layer-tdt-cva', 'visibility', isVec ? 'visible' : 'none')
  map.setLayoutProperty('layer-tdt-img', 'visibility', isVec ? 'none' : 'visible')
  map.setLayoutProperty('layer-tdt-cia', 'visibility', isVec ? 'none' : 'visible')
}

// 切换视图模式（2D 平面 Mercator / 3D 地球 Globe）
function switchViewMode(mode) {
  if (!map) return
  viewMode.value = mode
  if (typeof map.setProjection === 'function') {
    map.setProjection({ type: mode === '3d' ? 'globe' : 'mercator' })
  }
  if (mode === '3d') {
    map.easeTo({ pitch: 45, duration: 500 })
  } else {
    map.easeTo({ pitch: 0, bearing: 0, duration: 500 })
  }
}

function toggleViewMode() {
  switchViewMode(viewMode.value === '2d' ? '3d' : '2d')
}

function toggleBaseLayer() {
  switchBaseLayer(currentLayer.value === 'vec' ? 'img' : 'vec')
}

// 构建多坐标系点位数据
function createPointData(id, lng, lat) {
  const [gcjLng, gcjLat] = wgs84ToGcj02(lng, lat)
  const [bdLng, bdLat] = wgs84ToBd09(lng, lat)
  return { id, lng, lat, gcjLng, gcjLat, bdLng, bdLat }
}

// 创建标绘 DOM（外层 0×0 精准锚点 + 内层徽章/3D 立柱/地面投影）
function createMarkerElement(baseClass, text) {
  const el = document.createElement('div')
  el.className = baseClass

  const body = document.createElement('div')
  body.className = 'marker-body'

  const badge = document.createElement('span')
  badge.className = 'marker-badge'
  badge.textContent = text

  const stem = document.createElement('span')
  stem.className = 'marker-stem'

  const shadow = document.createElement('span')
  shadow.className = 'marker-shadow'

  body.append(badge, stem, shadow)
  el.appendChild(body)
  return el
}

// 同步所有已标绘点位的序号显示
function syncMarkerIndices() {
  pickedPoints.value.forEach((pt, idx) => {
    const marker = pointMarkers.get(pt.id)
    const badge = marker?.getElement().querySelector('.marker-badge')
    if (badge) {
      badge.textContent = String(idx + 1)
    }
  })
}

// 设置当前高亮选中点位（同步地图标注与表格高亮行）
function setActivePoint(id) {
  activePointId.value = id
  pointMarkers.forEach((marker, markerId) => {
    const el = marker.getElement()
    const isActive = markerId === id
    el.classList.toggle('active', isActive)
    el.style.zIndex = isActive ? '10' : ''
  })
  nextTick(() => {
    const row = pickedPoints.value.find(p => p.id === id) || null
    tableRef.value?.setCurrentRow(row)
  })
}

// 新增拾取点位并在地图上绘制带序号图标
function addPoint(lng, lat) {
  const id = nextPointId++
  const point = createPointData(id, lng, lat)
  pickedPoints.value.push(point)

  const el = createMarkerElement('picked-marker', String(pickedPoints.value.length))
  el.addEventListener('click', (evt) => {
    evt.stopPropagation()
    setActivePoint(id)
  })

  const marker = new maplibregl.Marker({ element: el, anchor: 'center', draggable: true })
    .setLngLat([lng, lat])
    .addTo(map)

  marker.on('dragend', () => {
    const pos = marker.getLngLat()
    const target = pickedPoints.value.find(p => p.id === id)
    if (target) {
      Object.assign(target, createPointData(id, pos.lng, pos.lat))
    }
    setActivePoint(id)
  })

  pointMarkers.set(id, marker)
  setActivePoint(id)
}

// 定位到指定点位
function locatePoint(point) {
  setActivePoint(point.id)
  map.flyTo({ center: [point.lng, point.lat], zoom: Math.max(map.getZoom(), 14) })
}

// 移除单个点位并重新编号
function removePoint(id) {
  const marker = pointMarkers.get(id)
  if (marker) {
    marker.remove()
    pointMarkers.delete(id)
  }
  pickedPoints.value = pickedPoints.value.filter(p => p.id !== id)
  syncMarkerIndices()
  if (activePointId.value === id) {
    const fallback = pickedPoints.value[pickedPoints.value.length - 1] || null
    setActivePoint(fallback ? fallback.id : null)
  }
}

// 清空所有点位
function clearAllPoints() {
  pointMarkers.forEach(marker => marker.remove())
  pointMarkers.clear()
  pickedPoints.value = []
  setActivePoint(null)
}

// 手动输入经纬度跳转并新增点位
function handleJump() {
  if (!coordQuery.value.trim()) return
  const parts = coordQuery.value.split(/[,，\s]+/).map(Number)
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const [lng, lat] = parts
    addPoint(lng, lat)
    map.flyTo({ center: [lng, lat], zoom: 14 })
  } else {
    ElMessage.warning('请输入正确的格式，例如：116.4074, 39.9042')
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

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max)
}

// 取当前地图视野范围作为检索范围（钳制经纬度以兼容 3D Globe 低缩放视图）
function getMapBound() {
  const b = map.getBounds()
  const west = clamp(b.getWest(), -180, 180)
  const south = clamp(b.getSouth(), -85, 85)
  const east = clamp(b.getEast(), -180, 180)
  const north = clamp(b.getNorth(), -85, 85)
  return [west, south, east, north].map(n => n.toFixed(6)).join(',')
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
    const el = createMarkerElement('poi-marker', String(index + 1))
    el.dataset.poiId = poi.id
    el.addEventListener('click', evt => {
      evt.stopPropagation()
      selectPoi(poi)
    })

    poiMarkers.push(
      new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([poi.lng, poi.lat])
        .addTo(map)
    )
  })
}

// 选中搜索结果：定位并新增拾取点位
function selectPoi(poi) {
  activePoiId.value = poi.id
  updateActivePoiMarker()
  scrollActivePoiIntoView()
  addPoint(poi.lng, poi.lat)
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

// 复制坐标（支持 Clipboard API 及降级方案）
async function copyText(val) {
  if (!val) return
  try {
    await navigator.clipboard.writeText(val)
    ElMessage.success('已复制坐标：' + val)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = val
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (copied) {
      ElMessage.success('已复制坐标：' + val)
    } else {
      ElMessage.error('复制失败，请手动复制')
    }
  }
}

// 导出当前拾取点位为 CSV
function handleExportCsv() {
  if (!exportPointsToCsv(pickedPoints.value, showOtherCoords.value)) {
    ElMessage.warning('暂无可导出的坐标点位')
    return
  }
  ElMessage.success(`已导出 ${pickedPoints.value.length} 个点位到 CSV`)
}

onMounted(() => {
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: createMapStyle(),
    center: [116.4074, 39.9042],
    zoom: 11,
    minZoom: 1,
    maxZoom: 18,
    attributionControl: false
  })

  map.addControl(new maplibregl.NavigationControl(), 'top-left')

  // 版权信息：左下角采用仿 OpenLayers 可折叠数据源标识（默认收起为 i 按钮，点击展开）
  // 需先于比例尺添加，保证版权按钮贴在最底部，比例尺位于其上方
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

  // 监听地图容器宽度变化（例如切换显示高德/百度列），保持画布自适应
  if (typeof ResizeObserver !== 'undefined' && mapContainer.value) {
    mapResizeObserver = new ResizeObserver(() => {
      map?.resize()
    })
    mapResizeObserver.observe(mapContainer.value)
  }

  // 点击地图持续添加拾取点位
  map.on('click', (e) => {
    addPoint(e.lngLat.lng, e.lngLat.lat)
  })

  document.addEventListener('click', handleTkOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleTkOutsideClick)
  if (mapResizeObserver) {
    mapResizeObserver.disconnect()
    mapResizeObserver = null
  }
  pointMarkers.forEach(marker => marker.remove())
  pointMarkers.clear()
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
  gap: 10px;
  margin-left: 28px;
}

.header-links :deep(.el-link) {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #f5f7fa;
  transition: background-color 0.15s ease;
}

.header-links :deep(.el-link:hover) {
  background: #edf2ff;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-divider {
  width: 1px;
  height: 18px;
  background: #e4e7ed;
  flex-shrink: 0;
}

/* 更改天地图密钥触发按钮与浮层 */
.tk-change {
  position: relative;
  display: flex;
  align-items: center;
}

.tk-trigger {
  height: 32px;
  padding: 0 11px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #ffffff;
  color: #4e5969;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.16s ease;
}

.tk-trigger:hover {
  color: #1677ff;
  border-color: #91caff;
  background: #f5f9ff;
}

.tk-trigger.active {
  color: #1677ff;
  border-color: #1677ff;
  background: #e6f4ff;
  font-weight: 600;
}

.tk-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #1677ff;
  margin-left: 1px;
}

.tk-popover {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  right: auto;
  width: 320px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(14px) saturate(160%);
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
  z-index: 30;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.popover-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
}

.popover-close {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #8c8c8c;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.popover-close:hover {
  color: #1f2329;
  background: rgba(15, 23, 42, 0.06);
}

.popover-form {
  display: flex;
  align-items: center;
  gap: 8px;
}

.popover-form :deep(.el-input__wrapper) {
  border-radius: 8px;
}

.popover-form :deep(.el-button) {
  border-radius: 8px;
  padding: 0 12px;
  height: 28px;
}

.popover-footer {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.popover-hint {
  font-size: 11px;
  color: #8c8c8c;
}

.brand-icon {
  color: #1677ff;
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

.main-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.map-wrapper {
  flex: 1;
  min-width: 0;
  position: relative;
}

.map-view {
  width: 100%;
  height: 100%;
}

/* 地图右下角垂直圆形悬浮工具栏 */
.map-fab-controls {
  position: absolute;
  right: 18px;
  bottom: 24px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.map-fab-btn {
  width: 44px;
  height: 44px;
  margin: 0 !important;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.18);
}

/* 右侧坐标面板收起/展开把手 */
.sidebar-toggle {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 5;
  width: 18px;
  height: 52px;
  padding: 0;
  border: 1px solid #e4e7ed;
  border-right: none;
  border-radius: 8px 0 0 8px;
  background: rgba(255, 255, 255, 0.94);
  color: #606266;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.08);
  transition: width 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}

.sidebar-toggle:hover {
  width: 22px;
  color: #1677ff;
  background: #ffffff;
}

.coord-sidebar {
  width: 410px;
  flex-shrink: 0;
  background: #ffffff;
  border-left: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  min-height: 0;
  transition: width 0.2s ease;
}

.coord-sidebar.wide {
  width: min(780px, 56vw);
}

.coord-sidebar.collapsed {
  width: 0;
  border-left: none;
  overflow: hidden;
}

.sidebar-top {
  padding: 12px 14px 10px;
  border-bottom: 1px solid #f0f0f0;
}

.sidebar-top :deep(.el-input__inner) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.sidebar-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1px solid #f0f0f0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.point-count {
  font-size: 12px;
  color: #606266;
  background: #f4f6f8;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sidebar-table {
  flex: 1;
  min-height: 0;
}

.coord-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.coord-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: #262626;
  white-space: nowrap;
}

.op-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
</style>

<style>
/* 左上角缩放/指南针控件统一为圆角毛玻璃白底风格 */
.maplibregl-ctrl-group {
  border-radius: 10px !important;
  background-color: rgba(255, 255, 255, 0.92) !important;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.14) !important;
  border: 1px solid rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

/* 左下角控件（比例尺、版权信息）贴左侧 8px、底部 8px */
.maplibregl-ctrl-bottom-left .maplibregl-ctrl {
  float: none;
  margin: 0 0 8px 8px !important;
}

/* 仿 OpenLayers 的可折叠数据源标识控件（默认收起为 i 按钮，点击展开与收起） */
.maplibregl-ctrl-bottom-left > .maplibregl-ctrl-attrib.maplibregl-compact {
  width: 24px;
  height: 24px;
  min-height: 24px;
  padding: 0;
  box-sizing: border-box;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.15);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}

.maplibregl-ctrl-bottom-left > .maplibregl-ctrl-attrib.maplibregl-compact.maplibregl-compact-show {
  width: auto;
  height: auto;
  padding: 0 8px 0 28px;
  border-radius: 4px;
}

.maplibregl-ctrl-bottom-left .maplibregl-ctrl-attrib-button {
  width: 22px;
  height: 22px;
  top: 0;
  left: 0;
  right: auto;
  padding: 0;
  border-radius: 3px;
  background-image: none;
  background-color: transparent;
  text-align: center;
  line-height: 22px;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 13px;
  font-weight: 700;
  color: #404040;
}

.maplibregl-ctrl-bottom-left .maplibregl-ctrl-attrib-button::after {
  content: 'i';
  font-style: italic;
}

.maplibregl-ctrl-bottom-left .maplibregl-ctrl-attrib-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: #1677ff;
}

.maplibregl-ctrl-bottom-left > .maplibregl-ctrl-attrib.maplibregl-compact-show .maplibregl-ctrl-attrib-button {
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 3px 0 0 3px;
  font-family: sans-serif;
  font-size: 14px;
}

.maplibregl-ctrl-bottom-left > .maplibregl-ctrl-attrib.maplibregl-compact-show .maplibregl-ctrl-attrib-button::after {
  content: '«';
  font-style: normal;
}

.maplibregl-ctrl-bottom-left .maplibregl-ctrl-attrib-inner {
  font-size: 11px;
  color: #595959;
  line-height: 22px;
  white-space: nowrap;
}

/* 隐藏默认 logo（保留左下角版权信息） */
.maplibregl-ctrl-logo {
  display: none !important;
}

/* 标绘与 POI 标注基础容器（0×0 精准锚点，避免缩放覆盖定位 transform） */
.picked-marker,
.poi-marker {
  width: 0;
  height: 0;
  position: relative;
  user-select: none;
}

.marker-body {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translate(-50%, -50%);
  transform-origin: center center;
  transition: transform 0.2s ease;
}

.marker-badge {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 2px solid #ffffff;
  color: #ffffff;
  font-weight: 600;
  transition: width 0.15s ease, height 0.15s ease, background 0.15s ease,
    box-shadow 0.15s ease;
}

.marker-stem,
.marker-shadow {
  display: none;
  pointer-events: none;
}

/* 2D 拾取点位样式 */
.picked-marker .marker-badge {
  width: 24px;
  height: 24px;
  background: #ff4d4f;
  font-size: 12px;
  cursor: grab;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}

.picked-marker:active .marker-badge {
  cursor: grabbing;
}

.picked-marker.active .marker-body {
  transform: translate(-50%, -50%) scale(1.22);
}

.picked-marker.active .marker-badge {
  background: #cf1322;
  box-shadow: 0 0 0 4px rgba(255, 77, 79, 0.3), 0 3px 10px rgba(255, 77, 79, 0.55);
}

/* 2D POI 搜索结果标注样式 */
.poi-marker .marker-badge {
  width: 22px;
  height: 22px;
  background: #1890ff;
  font-size: 11px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.poi-marker.active .marker-body {
  transform: translate(-50%, -50%) scale(1.25);
}

.poi-marker.active .marker-badge {
  background: #ff4d4f;
  box-shadow: 0 2px 8px rgba(255, 77, 79, 0.6);
}

/* 3D 视图立体球头立柱图钉样式（底端精准落点 + 地面投影） */
.map-view.is-3d .marker-body {
  transform: translate(-50%, -100%);
  transform-origin: center bottom;
}

.map-view.is-3d .picked-marker.active .marker-body,
.map-view.is-3d .poi-marker.active .marker-body {
  transform: translate(-50%, -100%) scale(1.18);
}

.map-view.is-3d .picked-marker .marker-badge {
  width: 28px;
  height: 28px;
  font-size: 12px;
  background: radial-gradient(circle at 32% 28%, #ff9c9e 0%, #ff4d4f 45%, #a8071a 100%);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.42), inset 0 -2px 4px rgba(0, 0, 0, 0.2);
}

.map-view.is-3d .picked-marker.active .marker-badge {
  background: radial-gradient(circle at 32% 28%, #ffb8b8 0%, #f5222d 48%, #820014 100%);
  box-shadow: 0 0 0 4px rgba(255, 77, 79, 0.32), 0 8px 16px rgba(207, 19, 34, 0.55);
}

.map-view.is-3d .poi-marker .marker-badge {
  width: 26px;
  height: 26px;
  font-size: 11px;
  background: radial-gradient(circle at 32% 28%, #91caff 0%, #1890ff 45%, #0958d9 100%);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.38), inset 0 -2px 4px rgba(0, 0, 0, 0.2);
}

.map-view.is-3d .poi-marker.active .marker-badge {
  background: radial-gradient(circle at 32% 28%, #ff9c9e 0%, #ff4d4f 45%, #a8071a 100%);
  box-shadow: 0 0 0 4px rgba(255, 77, 79, 0.3), 0 8px 16px rgba(255, 77, 79, 0.55);
}

.map-view.is-3d .marker-stem {
  display: block;
  position: relative;
  z-index: 1;
  width: 3px;
  height: 14px;
  margin-top: -1px;
  border-radius: 0 0 2px 2px;
  background: linear-gradient(to bottom, #a8071a, #ff7875 65%, #ffffff);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
}

.map-view.is-3d .poi-marker .marker-stem {
  background: linear-gradient(to bottom, #0958d9, #69b1ff 65%, #ffffff);
}

.map-view.is-3d .poi-marker.active .marker-stem {
  background: linear-gradient(to bottom, #a8071a, #ff7875 65%, #ffffff);
}

.map-view.is-3d .marker-shadow {
  display: block;
  position: absolute;
  bottom: -3px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 6px;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.48) 0%, rgba(0, 0, 0, 0) 72%);
}
</style>

