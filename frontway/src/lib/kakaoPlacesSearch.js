function mapKeywordPlace(place) {
  const lng = Number(place?.x);
  const lat = Number(place?.y);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: String(place?.id ?? `kw-${lat},${lng}`),
    title: String(place?.place_name ?? '').trim(),
    address: String(place?.road_address_name || place?.address_name || '').trim(),
    lat,
    lng,
    raw: place,
  };
}

function mapAddressItem(item) {
  const lng = Number(item?.x);
  const lat = Number(item?.y);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const road = String(item?.road_address_name ?? '').trim();
  const jibun = String(item?.address_name ?? '').trim();
  const title = road || jibun;
  if (!title) return null;
  return {
    id: String(`addr-${jibun || road}-${lat},${lng}`),
    title,
    address: jibun && road && jibun !== road ? jibun : '',
    lat,
    lng,
    raw: item,
  };
}

function coordKey(lat, lng) {
  return `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
}

/**
 * 키워드(장소) 결과를 우선하고, 같은 좌표는 한 번만 남깁니다.
 */
export function mergePlaceLists(primary, secondary, maxItems = 15) {
  const seen = new Set();
  const out = [];
  for (const p of [...primary, ...secondary]) {
    if (!p) continue;
    const k = coordKey(p.lat, p.lng);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * 카카오 로컬 키워드 장소 검색 (Places.keywordSearch).
 */
export function keywordSearchPlaces(kakao, keyword, options = {}) {
  return new Promise((resolve, reject) => {
    const q = String(keyword ?? '').trim();
    if (!q) {
      resolve([]);
      return;
    }

    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(
      q,
      (data, status) => {
        const { Status } = kakao.maps.services;
        if (status === Status.ERROR) {
          reject(new Error('키워드 장소 검색 중 오류가 발생했습니다.'));
          return;
        }
        if (status === Status.ZERO_RESULT) {
          resolve([]);
          return;
        }
        if (status === Status.OK) {
          const list = (data || []).map((p) => mapKeywordPlace(p)).filter(Boolean);
          resolve(list);
          return;
        }
        resolve([]);
      },
      { size: 10, ...options }
    );
  });
}

/**
 * 지번/도로명 주소 검색 (Geocoder.addressSearch).
 */
export function addressSearchPlaces(kakao, keyword) {
  return new Promise((resolve, reject) => {
    const q = String(keyword ?? '').trim();
    if (!q) {
      resolve([]);
      return;
    }

    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.addressSearch(q, (data, status) => {
      const { Status } = kakao.maps.services;
      if (status === Status.ERROR) {
        reject(new Error('주소 검색 중 오류가 발생했습니다.'));
        return;
      }
      if (status === Status.ZERO_RESULT) {
        resolve([]);
        return;
      }
      if (status === Status.OK) {
        const list = (data || []).map((item) => mapAddressItem(item)).filter(Boolean);
        resolve(list);
        return;
      }
      resolve([]);
    });
  });
}

/**
 * 입력창 드롭다운용: 키워드 장소 + 주소 검색을 병렬로 호출해 합칩니다.
 */
export async function searchPlacesForDropdown(kakao, keyword, options = {}) {
  const q = String(keyword ?? '').trim();
  if (!q) return [];

  const [kwSettled, addrSettled] = await Promise.allSettled([
    keywordSearchPlaces(kakao, q, options),
    addressSearchPlaces(kakao, q),
  ]);

  const kw = kwSettled.status === 'fulfilled' ? kwSettled.value : [];
  const addr = addrSettled.status === 'fulfilled' ? addrSettled.value : [];

  return mergePlaceLists(kw, addr, 15);
}
