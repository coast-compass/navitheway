import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchLockers } from '../api/lockerApi';
import { loadKakaoMaps } from '../lib/kakaoMaps';
import './LockerMapPage.css';

export default function LockerMapPage() {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const [stdgCd, setStdgCd] = useState('1100000000'); // 임시 고정(서울)
  const [lockers, setLockers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const summaryText = useMemo(() => {
    if (loading) return '불러오는 중...';
    if (error) return '에러 발생';
    return `${lockers.length}개 표시 중`;
  }, [loading, error, lockers.length]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setError('');
        setLoading(true);

        const [kakao, items] = await Promise.all([
          loadKakaoMaps(),
          fetchLockers({ stdgCd, pageNo: 1, numOfRows: 200 }),
        ]);
        if (cancelled) return;

        setLockers(items);

        if (!mapRef.current) {
          const center = items[0]
            ? new kakao.maps.LatLng(items[0].lat, items[0].lng)
            : new kakao.maps.LatLng(37.5665, 126.978); // fallback: 서울 시청 근처

          mapRef.current = new kakao.maps.Map(mapElRef.current, {
            center,
            level: 7,
          });
        }

        // 기존 마커 제거
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        const map = mapRef.current;
        const bounds = new kakao.maps.LatLngBounds();

        items.forEach((it) => {
          const pos = new kakao.maps.LatLng(it.lat, it.lng);
          bounds.extend(pos);

          const marker = new kakao.maps.Marker({
            position: pos,
            title: it.name || it.id,
          });
          marker.setMap(map);
          markersRef.current.push(marker);
        });

        if (items.length >= 2) {
          map.setBounds(bounds, 36, 36, 36, 36);
        } else if (items.length === 1) {
          map.panTo(new kakao.maps.LatLng(items[0].lat, items[0].lng));
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [stdgCd]);

  return (
    <div className="LockerPage">
      <div className="LockerTopbar">
        <div className="LockerTitle">물품보관함 지도</div>
        <div className="LockerControls">
          <label className="LockerLabel">
            stdgCd
            <input
              className="LockerInput"
              value={stdgCd}
              onChange={(e) => setStdgCd(e.target.value)}
              placeholder="예: 1100000000"
            />
          </label>
          <div className="LockerSummary">{summaryText}</div>
        </div>
      </div>

      {error ? <div className="LockerError">{error}</div> : null}

      <div className="LockerBody">
        <div className="LockerMap" ref={mapElRef} />
      </div>
    </div>
  );
}

