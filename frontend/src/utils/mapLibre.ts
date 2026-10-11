export function toMapLibreLngLat(lat: number, lng: number): [number, number] {
  return [lng, lat]
}

export function toLatLng(lngLat: [number, number]): { lat: number; lng: number } {
  return { lat: lngLat[1], lng: lngLat[0] }
}
