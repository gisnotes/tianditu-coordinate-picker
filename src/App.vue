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

    <!-- 主体区域：左侧地图 + 右侧多点坐标表格栏 -->
    <div class="main-body">
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
      </div>

      <!-- 右侧坐标拾取列表侧边栏 -->
      <aside class="coord-sidebar" :class="{ wide: showOtherCoords }">
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
          <el-checkbox v-model="showOtherCoords">显示高德/百度</el-checkbox>
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
import mapboxgl from 'mapbox-gl'
import { ElMessage } from 'element-plus'
import { Close, CopyDocument, Delete, Download, Files, MapLocation } from '@element-plus/icons-vue'
import { wgs84ToGcj02, wgs84ToBd09 } from './utils/coordTransform'
import { exportPointsToCsv } from './utils/exportCsv'

// Mapbox Access Token（通过 .env.local 中的 VITE_MAPBOX_TOKEN 配置）
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const mapContainer = ref(null)
const currentLayer = ref('vec')
const layerPanelOpen = ref(false)
const pickedPoints = ref([])
const activePointId = ref(null)
const showOtherCoords = ref(true)
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

// 构建多坐标系点位数据
function createPointData(id, lng, lat) {
  const [gcjLng, gcjLat] = wgs84ToGcj02(lng, lat)
  const [bdLng, bdLat] = wgs84ToBd09(lng, lat)
  return { id, lng, lat, gcjLng, gcjLat, bdLng, bdLat }
}

// 同步所有已标绘点位的序号显示
function syncMarkerIndices() {
  pickedPoints.value.forEach((pt, idx) => {
    const marker = pointMarkers.get(pt.id)
    if (marker) {
      marker.getElement().textContent = String(idx + 1)
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

  const el = document.createElement('div')
  el.className = 'picked-marker'
  el.textContent = String(pickedPoints.value.length)
  el.addEventListener('click', (evt) => {
    evt.stopPropagation()
    setActivePoint(id)
  })

  const marker = new mapboxgl.Marker({ element: el, anchor: 'center', draggable: true })
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

  // 监听地图容器宽度变化（例如切换显示高德/百度列），保持画布自适应
  if (typeof ResizeObserver !== 'undefined' && mapContainer.value) {
    mapResizeObserver = new ResizeObserver(() => {
      map?.resize()
    })
    mapResizeObserver.observe(mapContainer.value)
  }

  // 点击地图持续添加拾取点位
  map.on('click', (e) => {
    layerPanelOpen.value = false
    addPoint(e.lngLat.lng, e.lngLat.lat)
  })
})

onUnmounted(() => {
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

.coord-sidebar {
  width: 410px;
  flex-shrink: 0;
  background: #ffffff;
  border-left: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.coord-sidebar.wide {
  width: min(780px, 56vw);
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

/* 已拾取点位标绘图标（红色圆形带序号徽章） */
.picked-marker {
  width: 24px;
  height: 24px;
  line-height: 20px;
  text-align: center;
  border-radius: 50%;
  background: #ff4d4f;
  border: 2px solid #ffffff;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  cursor: grab;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
  user-select: none;
}

.picked-marker:active {
  cursor: grabbing;
}

.picked-marker.active {
  transform: scale(1.25);
  background: #cf1322;
  box-shadow: 0 0 0 4px rgba(255, 77, 79, 0.3), 0 3px 10px rgba(255, 77, 79, 0.55);
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

