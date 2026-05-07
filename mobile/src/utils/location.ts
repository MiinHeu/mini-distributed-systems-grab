/**
 * Tiện ích xử lý tọa độ và địa chỉ
 */

/**
 * Chuyển đổi tọa độ thành địa chỉ người đọc được (Reverse Geocoding)
 * Sử dụng Nominatim API của OpenStreetMap (Miễn phí)
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'MiniGrabApp/1.0',
        },
      }
    );
    const data = await response.json();
    
    if (data && data.display_name) {
      // display_name thường rất dài, ta có thể rút gọn
      const addr = data.address;
      const parts = [];
      
      if (addr.house_number) parts.push(addr.house_number);
      if (addr.road) parts.push(addr.road);
      if (addr.suburb) parts.push(addr.suburb);
      if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
      
      return parts.length > 0 ? parts.join(', ') : data.display_name;
    }
    return `Tọa độ: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
  } catch (error) {
    console.warn('Reverse Geocode failed:', error);
    return `Tọa độ: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
  }
}
