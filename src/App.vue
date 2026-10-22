<template>
  <div class="coordinate-picker-app">
    <!-- 顶部操作栏 -->
    <header class="app-header">
      <div class="brand">
        <span class="icon">📍</span>
        <span class="title">天地图在线坐标拾取系统</span>
      </div>
      <div class="search-box">
        <input 
          v-model="searchQuery" 
          placeholder="输入经度,纬度跳转 (例: 116.4074, 39.9042)" 
          @keyup.enter="handleJump"
        />
        <button @click="handleJump">定位</button>
      </div>
    </header>

    <!-- 地图容器主体 -->
    <div class="map-wrapper">
      <div ref="mapContainer" class="map-view"></div>

      <!-- 右上角底图类型切换器 (矢量 / 影像) -->
      <div class="layer-switcher">
        <div 
          class="switch-card" 
          :class="{ active: currentLayer === 'vec' }" 
          @click="switchBaseLayer('vec')"
          title="天地图矢量电子地图"
        >
          <div class="card-thumb vec-thumb"></div>
          <span class="card-name">矢量地图</span>
        </div>
        <div 
          class="switch-card" 
          :class="{ active: currentLayer === 'img' }" 
          @click="switchBaseLayer('img')"
          title="天地图卫星影像地图"
        >
          <div class="card-thumb img-thumb"></div>
          <span class="card-name">卫星影像</span>
        </div>
      </div>

      <!-- 底部天地图审图标识 -->
      <div class="tdt-attribution">
        <span class="logo-text">Tianditu 天地图</span>
        <span class="divider">|</span>
        <span>审图号：GS(2024)0000号 - 1:400万天地图数据</span>
      </div>

      <!-- 浮动坐标拾取面板 -->
      <div v-if="pickedCoord" class="coord-card">
        <div class="card-header">
          <span class="card-title">📌 当前拾取坐标</span>
          <button class="close-btn" @click="pickedCoord = null">×</button>
        </div>
        <div class="coord-group">
          <div class="coord-item">
            <span class="label">WGS-84 (CGCS2000):</span>
            <span class="value">{{ pickedCoord.lng.toFixed(6) }}, {{ pickedCoord.lat.toFixed(6) }}</span>
            <button class="copy-btn" @click="copyText(`${pickedCoord.lng.toFixed(6)}, ${pickedCoord.lat.toFixed(6)}`)">复制</button>
          </div>
          <div class="coord-item">
            <span class="label">GCJ-02 (高德/腾讯):</span>
            <span class="value">{{ gcjCoord[0].toFixed(6) }}, {{ gcjCoord[1].toFixed(6) }}</span>
            <button class="copy-btn" @click="copyText(`${gcjCoord[0].toFixed(6)}, ${gcjCoord[1].toFixed(6)}`)">复制</button>
          </div>
          <div class="coord-item">
            <span class="label">BD-09 (百度地图):</span>
            <span class="value">{{ bdCoord[0].toFixed(6) }}, {{ bdCoord[1].toFixed(6) }}</span>
            <button class="copy-btn" @click="copyText(`${bdCoord[0].toFixed(6)}, ${bdCoord[1].toFixed(6)}`)">复制</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import mapboxgl from 'mapbox-gl'
import { wgs84ToGcj02, wgs84ToBd09 } from './utils/coordTransform'

// Mapbox Access Token（通过 .env.local 中的 VITE_MAPBOX_TOKEN 配置）
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const mapContainer = ref(null)
const currentLayer = ref('vec')
const pickedCoord = ref({ lng: 116.4074, lat: 39.9042 })
const searchQuery = ref('')

let map = null
let marker = null

// 天地图服务端 Token (tk)，通过 .env.local 中的 VITE_TDT_KEY 配置
// 注意：需在国家地理信息公共服务平台 (https://console.tianditu.gov.cn/) 申请「浏览器端」Token
const TDT_KEY = import.meta.env.VITE_TDT_KEY

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
        tileSize: 256
      },
      'tdt-cva': {
        type: 'raster',
        tiles: getTdtUrls('cva'),
        tileSize: 256
      },
      'tdt-img': {
        type: 'raster',
        tiles: getTdtUrls('img'),
        tileSize: 256
      },
      'tdt-cia': {
        type: 'raster',
        tiles: getTdtUrls('cia'),
        tileSize: 256
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
  if (!searchQuery.value) return
  const parts = searchQuery.value.split(/[,，\s]+/).map(Number)
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const [lng, lat] = parts
    setCoord(lng, lat)
    map.flyTo({ center: [lng, lat], zoom: 14 })
  } else {
    alert('请输入正确的格式，例如：116.4074, 39.9042')
  }
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
  map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left')

  // 初始化默认点
  setCoord(116.4074, 39.9042)

  // 点击地图拾取坐标
  map.on('click', (e) => {
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

.search-box {
  display: flex;
  gap: 8px;
}

.search-box input {
  width: 320px;
  padding: 6px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  outline: none;
  font-size: 13px;
}

.search-box input:focus {
  border-color: #1890ff;
}

.search-box button {
  padding: 6px 16px;
  background: #1890ff;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.search-box button:hover {
  background: #40a9ff;
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
  display: flex;
  gap: 10px;
  background: #ffffff;
  padding: 8px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  z-index: 5;
}

.switch-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  border: 2px solid transparent;
}

.switch-card.active {
  border-color: #1890ff;
  background-color: #f0f7ff;
}

.card-thumb {
  width: 56px;
  height: 42px;
  border-radius: 4px;
  background-size: cover;
}

.vec-thumb {
  background-color: #e6f4ff;
  background-image: linear-gradient(135deg, #cbe3fb 25%, #e1effe 25%, #e1effe 50%, #cbe3fb 50%, #cbe3fb 75%, #e1effe 75%, #e1effe 100%);
  border: 1px solid #91caff;
}

.img-thumb {
  background-color: #132238;
  background-image: linear-gradient(135deg, #1b382b 25%, #264a39 25%, #264a39 50%, #1b382b 50%, #1b382b 75%, #264a39 75%, #264a39 100%);
  border: 1px solid #30543e;
}

.card-name {
  font-size: 12px;
  color: #333;
}

.tdt-attribution {
  position: absolute;
  bottom: 8px;
  left: 100px;
  background: rgba(255, 255, 255, 0.9);
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.logo-text {
  color: #1890ff;
  font-weight: bold;
}

.coord-card {
  position: absolute;
  bottom: 24px;
  right: 16px;
  width: 380px;
  background: #ffffff;
  padding: 16px;
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
  font-size: 15px;
  font-weight: 600;
  color: #262626;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #8c8c8c;
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

.copy-btn {
  padding: 2px 8px;
  font-size: 12px;
  background: #fafafa;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  cursor: pointer;
}

.copy-btn:hover {
  color: #1890ff;
  border-color: #1890ff;
}
</style>
