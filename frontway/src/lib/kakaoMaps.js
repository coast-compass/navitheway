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

export function loadKakaoMaps() {
  if (window.kakao?.maps) return Promise.resolve(window.kakao);

  const existing = document.getElementById(SCRIPT_ID);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(window.kakao));
      existing.addEventListener('error', () =>
        reject(new Error('Kakao Maps SDK 로드에 실패했습니다.'))
      );
    });
  }

  const appKey = ensureEnvKey();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      appKey
    )}&autoload=false`;

    script.onload = () => {
      if (!window.kakao?.maps?.load) {
        reject(new Error('Kakao Maps SDK가 올바르게 로드되지 않았습니다.'));
        return;
      }
      window.kakao.maps.load(() => resolve(window.kakao));
    };
    script.onerror = () =>
      reject(new Error('Kakao Maps SDK 스크립트 로드에 실패했습니다.'));

    document.head.appendChild(script);
  });
}

