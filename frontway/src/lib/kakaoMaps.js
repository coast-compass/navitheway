const SCRIPT_ID = 'kakao-maps-sdk';

function ensureEnvKey() {
  const appKey = process.env.REACT_APP_KAKAO_MAP_KEY;
  if (!appKey) {
    throw new Error(
      'REACT_APP_KAKAO_MAP_KEY가 설정되지 않았습니다. frontway/.env에 추가해주세요.'
    );
  }
  return appKey;
}

/**
 * autoload=false 이므로 반드시 kakao.maps.load() 콜백 안에서만
 * LatLng, Map 등을 사용할 수 있습니다. maps 객체만 있다고 해서 바로 resolve 하면 안 됩니다.
 */
function whenMapsReady() {
  return new Promise((resolve, reject) => {
    if (!window.kakao?.maps?.load) {
      reject(
        new Error('Kakao Maps SDK가 올바르게 로드되지 않았습니다.')
      );
      return;
    }
    window.kakao.maps.load(() => resolve(window.kakao));
  });
}

export function loadKakaoMaps() {
  if (window.kakao?.maps?.load) {
    return whenMapsReady();
  }

  const existing = document.getElementById(SCRIPT_ID);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener(
        'error',
        () => reject(new Error('Kakao Maps SDK 로드에 실패했습니다.')),
        { once: true }
      );
      let kicked = false;
      const kick = () => {
        if (kicked || !window.kakao?.maps?.load) return;
        kicked = true;
        whenMapsReady().then(resolve, reject);
      };
      if (window.kakao?.maps?.load) {
        kick();
        return;
      }
      existing.addEventListener('load', kick, { once: true });
      queueMicrotask(kick);
    });
  }

  const appKey = ensureEnvKey();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      appKey
    )}&autoload=false&libraries=services`;

    script.onload = () => {
      whenMapsReady().then(resolve, reject);
    };
    script.onerror = () =>
      reject(new Error('Kakao Maps SDK 스크립트 로드에 실패했습니다.'));

    document.head.appendChild(script);
  });
}
