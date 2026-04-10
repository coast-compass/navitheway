import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { fetchLockers } from '../api/lockerApi';
import { geodesicMidpoint, haversineMeters } from '../lib/geo';
import { searchPlacesForDropdown } from '../lib/kakaoPlacesSearch';
import { loadKakaoMaps } from '../lib/kakaoMaps';
import './LockerMapPage.css';

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };
const SEARCH_DEBOUNCE_MS = 320;
const MIN_SEARCH_QUERY_LEN = 2;

function PlaceSearchField({ label, accent, kakao, selected, onSelect, disabled }) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [emptyAfterSearch, setEmptyAfterSearch] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);

  const rootRef = useRef(null);
  const inputWrapRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (selected) setInputValue(selected.title);
    else setInputValue('');
  }, [selected]);

  const updateMenuPosition = useCallback(() => {
    const el = inputWrapRef.current;
    if (!el) {
      setMenuStyle(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const gap = 6;
    const maxH = Math.min(220, Math.max(100, window.innerHeight - r.bottom - gap - 20));
    setMenuStyle({
      position: 'fixed',
      top: r.bottom + gap,
      left: r.left,
      width: r.width,
      maxHeight: maxH,
      zIndex: 10050,
    });
  }, []);

  const showDropdown = useMemo(
    () =>
      open &&
      kakao &&
      (suggestions.length > 0 ||
        (emptyAfterSearch && inputValue.trim().length >= MIN_SEARCH_QUERY_LEN)),
    [open, kakao, suggestions.length, emptyAfterSearch, inputValue]
  );

  useLayoutEffect(() => {
    if (!showDropdown) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [showDropdown, updateMenuPosition, suggestions.length, emptyAfterSearch]);

  useEffect(() => {
    if (!kakao) return;
    const q = inputValue.trim();
    if (q.length < MIN_SEARCH_QUERY_LEN) {
      setSuggestions([]);
      setEmptyAfterSearch(false);
      return;
    }
    if (selected && q === selected.title) {
      setSuggestions([]);
      setEmptyAfterSearch(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setSearching(true);
        setEmptyAfterSearch(false);
        const list = await searchPlacesForDropdown(kakao, q);
        if (!cancelled) {
          setSuggestions(list);
          setEmptyAfterSearch(list.length === 0);
          setOpen(true);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setEmptyAfterSearch(false);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [inputValue, kakao, selected]);

  useEffect(() => {
    function onDocDown(e) {
      if (rootRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const dropdownNode =
    showDropdown && menuStyle
      ? createPortal(
          <ul
            ref={menuRef}
            className="LockerSuggest LockerSuggest--portal"
            style={menuStyle}
            aria-label={`${label} 검색 결과`}
          >
            {suggestions.length === 0 ? (
              <li className="LockerSuggestEmpty">
                검색 결과가 없습니다. 다른 검색어를 입력해 보세요.
              </li>
            ) : (
              suggestions.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="LockerSuggestItem"
                    onClick={() => {
                      onSelect({
                        title: p.title,
                        lat: p.lat,
                        lng: p.lng,
                        address: p.address,
                      });
                      setOpen(false);
                      setSuggestions([]);
                      setEmptyAfterSearch(false);
                    }}
                  >
                    <span className="LockerSuggestTitle">{p.title}</span>
                    {p.address ? (
                      <span className="LockerSuggestAddr">{p.address}</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body
        )
      : null;

  return (
    <div className={`LockerField ${accent ? `LockerField--${accent}` : ''}`} ref={rootRef}>
      <div className="LockerFieldHead">
        <span className="LockerFieldLabel">{label}</span>
        {selected ? (
          <button
            type="button"
            className="LockerFieldClear"
            onClick={() => {
              onSelect(null);
              setInputValue('');
              setSuggestions([]);
              setOpen(false);
              setEmptyAfterSearch(false);
            }}
            disabled={disabled}
          >
            지우기
          </button>
        ) : null}
      </div>
      <div className="LockerFieldInputWrap" ref={inputWrapRef}>
        <input
          className="LockerFieldInput"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="장소·주소 검색 (2글자 이상)"
          disabled={disabled || !kakao}
          autoComplete="off"
          enterKeyHint="search"
        />
        <span className="LockerFieldInputMeta" aria-hidden>
          {searching ? '검색 중…' : ''}
        </span>
      </div>
      {dropdownNode}
    </div>
  );
}

export default function LockerMapPage() {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef({
    circle: null,
    polyline: null,
    lockerMarkers: [],
    endpointMarkers: [],
  });

  const [kakao, setKakao] = useState(null);
  const [mapInitError, setMapInitError] = useState('');

  const [stdgCd, setStdgCd] = useState('1100000000');
  const [showStdg, setShowStdg] = useState(false);

  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [result, setResult] = useState(null);

  const summaryText = useMemo(() => {
    if (busy) return '불러오는 중…';
    if (!result) return '출발지·도착지를 선택한 뒤 찾기를 눌러주세요';
    const { count, diameterKm, radiusKm } = result;
    return `직선 거리 약 ${diameterKm}km · 반경 ${radiusKm}km 안 보관함 ${count}곳`;
  }, [busy, result]);

  function clearMapOverlays() {
    const o = overlaysRef.current;
    if (o.circle) {
      o.circle.setMap(null);
      o.circle = null;
    }
    if (o.polyline) {
      o.polyline.setMap(null);
      o.polyline = null;
    }
    o.lockerMarkers.forEach((m) => m.setMap(null));
    o.lockerMarkers = [];
    o.endpointMarkers.forEach((m) => m.setMap(null));
    o.endpointMarkers = [];
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setMapInitError('');
        const kakaoSdk = await loadKakaoMaps();
        if (cancelled) return;
        setKakao(kakaoSdk);
        if (!mapRef.current && mapElRef.current) {
          mapRef.current = new kakaoSdk.maps.Map(mapElRef.current, {
            center: new kakaoSdk.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
            level: 6,
          });
        }
        window.requestAnimationFrame(() => {
          mapRef.current?.relayout();
        });
      } catch (e) {
        if (!cancelled) {
          setMapInitError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function relayoutMap() {
      mapRef.current?.relayout();
    }
    window.addEventListener('resize', relayoutMap);
    const timer = window.setTimeout(relayoutMap, 120);
    return () => {
      window.removeEventListener('resize', relayoutMap);
      window.clearTimeout(timer);
    };
  }, []);

  async function handleFindLockers() {
    setActionError('');
    setResult(null);

    if (!kakao || !mapRef.current) {
      setActionError('지도를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    if (!origin || !destination) {
      setActionError('출발지와 도착지를 모두 검색해서 선택해주세요.');
      return;
    }

    const diameterM = haversineMeters(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng
    );
    if (diameterM < 30) {
      setActionError('출발지와 도착지가 너무 가깝습니다. 서로 다른 두 지점을 선택해주세요.');
      return;
    }

    const radiusM = diameterM / 2;
    const center = geodesicMidpoint(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng
    );

    try {
      setBusy(true);
      const items = await fetchLockers({
        stdgCd,
        pageNo: 1,
        numOfRows: 200,
      });

      const inside = items.filter((it) => {
        const d = haversineMeters(center.lat, center.lng, it.lat, it.lng);
        return d <= radiusM + 3;
      });

      const map = mapRef.current;
      clearMapOverlays();
      const o = overlaysRef.current;

      const linePath = [
        new kakao.maps.LatLng(origin.lat, origin.lng),
        new kakao.maps.LatLng(destination.lat, destination.lng),
      ];
      o.polyline = new kakao.maps.Polyline({
        path: linePath,
        strokeWeight: 4,
        strokeColor: '#7c9cff',
        strokeOpacity: 0.85,
        strokeStyle: 'solid',
      });
      o.polyline.setMap(map);

      o.circle = new kakao.maps.Circle({
        center: new kakao.maps.LatLng(center.lat, center.lng),
        radius: radiusM,
        strokeWeight: 2,
        strokeColor: '#a8b8ff',
        strokeOpacity: 0.95,
        strokeStyle: 'solid',
        fillColor: '#a8b8ff',
        fillOpacity: 0.12,
      });
      o.circle.setMap(map);

      const startM = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(origin.lat, origin.lng),
        title: '출발지',
      });
      const endM = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(destination.lat, destination.lng),
        title: '도착지',
      });
      startM.setMap(map);
      endM.setMap(map);
      o.endpointMarkers.push(startM, endM);

      inside.forEach((it) => {
        const pos = new kakao.maps.LatLng(it.lat, it.lng);
        const marker = new kakao.maps.Marker({
          position: pos,
          title: it.name || it.id,
        });
        marker.setMap(map);
        o.lockerMarkers.push(marker);
      });

      const bounds = new kakao.maps.LatLngBounds();
      bounds.extend(new kakao.maps.LatLng(origin.lat, origin.lng));
      bounds.extend(new kakao.maps.LatLng(destination.lat, destination.lng));
      inside.forEach((it) => bounds.extend(new kakao.maps.LatLng(it.lat, it.lng)));

      if (inside.length === 0) {
        bounds.extend(new kakao.maps.LatLng(center.lat, center.lng));
      }

      map.setBounds(bounds, 56, 56, 56, 120);

      window.requestAnimationFrame(() => {
        map.relayout();
      });

      const fmt = (m) => (m / 1000).toFixed(m >= 10000 ? 1 : 2);
      setResult({
        count: inside.length,
        diameterKm: fmt(diameterM),
        radiusKm: fmt(radiusM),
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const panelDisabled = !kakao || Boolean(mapInitError);

  return (
    <div className="LockerPage">
      <header className="LockerHeader">
        <div>
          <h1 className="LockerHeaderTitle">물품보관함 지도</h1>
          <p className="LockerHeaderSub">출발·도착을 정하면 그 사이를 지름으로 하는 원 안만 표시해요</p>
        </div>
      </header>

      {mapInitError ? <div className="LockerError">{mapInitError}</div> : null}
      {actionError ? <div className="LockerError LockerError--soft">{actionError}</div> : null}

      <div className="LockerMapStage">
        <div className="LockerMap" ref={mapElRef} />
      </div>

      <div className="LockerPanel">
        <PlaceSearchField
          label="출발지"
          accent="from"
          kakao={kakao}
          selected={origin}
          onSelect={setOrigin}
          disabled={panelDisabled || busy}
        />
        <PlaceSearchField
          label="도착지"
          accent="to"
          kakao={kakao}
          selected={destination}
          onSelect={setDestination}
          disabled={panelDisabled || busy}
        />

        <button
          type="button"
          className="LockerPrimaryBtn"
          onClick={handleFindLockers}
          disabled={panelDisabled || busy}
        >
          {busy ? '불러오는 중…' : '물품보관함 찾기'}
        </button>

        <div className="LockerSummaryRow">
          <span className="LockerSummary">{summaryText}</span>
          <button
            type="button"
            className="LockerLinkBtn"
            onClick={() => setShowStdg((v) => !v)}
          >
            지역코드
          </button>
        </div>

        {showStdg ? (
          <label className="LockerStdg">
            <span>stdgCd (공공데이터 행정구역)</span>
            <input
              className="LockerStdgInput"
              value={stdgCd}
              onChange={(e) => setStdgCd(e.target.value)}
              placeholder="예: 1100000000"
              disabled={busy}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
