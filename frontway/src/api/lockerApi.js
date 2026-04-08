function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchLockers({
  stdgCd = '1100000000',
  pageNo = 1,
  numOfRows = 100,
}) {
  const url = new URL('/api/locker', window.location.origin);
  url.searchParams.set('type', 'JSON');
  url.searchParams.set('stdgCd', String(stdgCd));
  url.searchParams.set('pageNo', String(pageNo));
  url.searchParams.set('numOfRows', String(numOfRows));

  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`물품보관함 API 호출 실패 (${res.status}) ${text}`);
  }

  const data = await res.json();
  const items = data?.body?.item ?? [];

  return items
    .map((it) => {
      const lat = toNumber(it?.lat);
      const lng = toNumber(it?.lot);
      if (lat == null || lng == null) return null;
      return {
        id: String(it?.stlckId ?? `${lat},${lng}`),
        name: String(it?.stlckRprsPstnNm ?? ''),
        detail: String(it?.stlckDtlPstnNm ?? ''),
        addressRoad: String(it?.fcltRoadNmAddr ?? ''),
        addressLot: String(it?.fcltLotnoAddr ?? ''),
        lat,
        lng,
        raw: it,
      };
    })
    .filter(Boolean);
}

