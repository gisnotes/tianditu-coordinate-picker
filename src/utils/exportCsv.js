/**
 * 将已拾取的坐标点位导出为 CSV 文件并触发浏览器下载
 * @param {Array<{lng: number, lat: number, gcjLng: number, gcjLat: number, bdLng: number, bdLat: number}>} points
 * @param {boolean} includeOtherCoords 是否包含高德(GCJ-02)和百度(BD-09)坐标列
 * @returns {boolean} 是否成功触发导出
 */
export function exportPointsToCsv(points, includeOtherCoords = true) {
  if (!Array.isArray(points) || points.length === 0) {
    return false
  }

  const headers = includeOtherCoords
    ? [
        '序号',
        '天地图经度(CGCS2000)',
        '天地图纬度(CGCS2000)',
        '高德经度(GCJ-02)',
        '高德纬度(GCJ-02)',
        '百度经度(BD-09)',
        '百度纬度(BD-09)'
      ]
    : ['序号', '天地图经度(CGCS2000)', '天地图纬度(CGCS2000)']

  const rows = points.map((pt, index) => {
    const base = [index + 1, pt.lng.toFixed(6), pt.lat.toFixed(6)]
    if (includeOtherCoords) {
      base.push(
        pt.gcjLng.toFixed(6),
        pt.gcjLat.toFixed(6),
        pt.bdLng.toFixed(6),
        pt.bdLat.toFixed(6)
      )
    }
    return base.join(',')
  })

  // 添加 UTF-8 BOM，避免 Excel 打开中文表头乱码
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

  const link = document.createElement('a')
  link.href = url
  link.download = `tianditu-coordinates-${timestamp}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  return true
}
