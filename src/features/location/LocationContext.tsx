/**
 * 탐색 기준 위치 관리 (MAP-01, MAP-02)
 *
 * 핵심 원칙
 *  - GPS 권한을 허용하면 **단말이 준 좌표를 그대로** 기준점으로 쓴다.
 *    지역 목록의 좌표로 "스냅"하지 않는다. (전국 어디서든 정확히 동작)
 *  - 지역 목록은 표시용 라벨과 "직접 선택" 용도로만 쓴다.
 *    가까운 등록 지역이 20km 밖이면 지역명 대신 '현재 위치'로만 표시한다.
 *  - 권한을 거부하면 선택한 지역 중심 좌표로 폴백한다.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_REGION, findRegion, nearestRegion, regionLabel, type Region } from '@/constants/regions';
import type { LatLng } from '@/lib/geo';

type LocationSource = 'region' | 'gps';

interface LocationContextValue {
  /** 탐색 기준 좌표 */
  origin: LatLng;
  /** 선택된 지역 (select 값으로 사용) */
  region: Region;
  /** 화면에 표시할 현재 기준 위치 라벨 */
  label: string;
  source: LocationSource;
  geoStatus: 'idle' | 'loading' | 'granted' | 'denied' | 'unsupported';
  geoMessage: string | null;
  setRegionByCode: (code: string) => void;
  requestCurrentPosition: () => void;
}

const STORAGE_KEY = 'haru.location.v2';
/** 저장된 GPS 좌표의 유효 기간. 지나면 지역 기준으로 되돌린다. */
const GPS_TTL_MS = 6 * 60 * 60 * 1000;

interface StoredLocation {
  regionCode: string;
  source: LocationSource;
  gps: LatLng | null;
  savedAt: number;
}

function readStored(): StoredLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLocation;
    if (!parsed.regionCode) return null;
    // 오래된 GPS 좌표는 버린다 (이동했을 수 있으므로)
    if (parsed.source === 'gps' && Date.now() - parsed.savedAt > GPS_TTL_MS) {
      return { ...parsed, source: 'region', gps: null };
    }
    return parsed;
  } catch {
    return null;
  }
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const stored = readStored();
  const [region, setRegion] = useState<Region>(() => findRegion(stored?.regionCode) ?? DEFAULT_REGION);
  // GPS 좌표도 보관한다. 새로고침·로그인 전환 후에도 같은 기준 위치가 유지되어야
  // "방금 등록한 공고가 목록에서 사라지는" 문제가 생기지 않는다.
  const [gps, setGps] = useState<LatLng | null>(stored?.gps ?? null);
  const [source, setSource] = useState<LocationSource>(stored?.source ?? 'region');
  const [geoStatus, setGeoStatus] = useState<LocationContextValue['geoStatus']>('idle');
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const payload: StoredLocation = {
        regionCode: region.code,
        source,
        gps: source === 'gps' ? gps : null,
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* 무시 */
    }
  }, [region, source, gps]);

  const setRegionByCode = useCallback((code: string) => {
    setRegion(findRegion(code));
    setSource('region');
    setGeoMessage(null);
  }, []);

  const requestCurrentPosition = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('unsupported');
      setGeoMessage('이 브라우저는 위치 기능을 지원하지 않습니다. 지역을 직접 선택해 주세요.');
      return;
    }
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      setGeoStatus('unsupported');
      setGeoMessage('보안 연결(https) 또는 localhost에서만 위치를 사용할 수 있습니다. 지역을 직접 선택해 주세요.');
      return;
    }

    setGeoStatus('loading');
    setGeoMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGps(next);
        setSource('gps');
        // 목록에 가까운 지역이 있으면 select 값도 맞춰주되, 기준 좌표는 GPS 값을 그대로 쓴다.
        const near = nearestRegion(next.lat, next.lng);
        if (near) setRegion(near);
        setGeoStatus('granted');
        setGeoMessage(
          near
            ? null
            : '현재 위치를 기준으로 표시합니다. (등록된 지역 목록에 없는 지역이라 좌표 기준으로만 탐색합니다)',
        );
      },
      (err) => {
        setGeoStatus('denied');
        setSource('region');
        setGeoMessage(
          err.code === err.PERMISSION_DENIED
            ? '위치 권한이 없어 선택한 지역을 기준으로 표시합니다.'
            : '위치를 가져오지 못해 선택한 지역을 기준으로 표시합니다.',
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  const origin = useMemo<LatLng>(
    () => (source === 'gps' && gps ? gps : { lat: region.lat, lng: region.lng }),
    [source, gps, region],
  );

  const label = useMemo(() => {
    if (source === 'gps' && gps) {
      const near = nearestRegion(gps.lat, gps.lng);
      return near ? `현재 위치 · ${near.name}` : '현재 위치';
    }
    return regionLabel(region);
  }, [source, gps, region]);

  const value = useMemo<LocationContextValue>(
    () => ({ origin, region, label, source, geoStatus, geoMessage, setRegionByCode, requestCurrentPosition }),
    [origin, region, label, source, geoStatus, geoMessage, setRegionByCode, requestCurrentPosition],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationContext(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationContext는 LocationProvider 내부에서만 사용할 수 있습니다.');
  return ctx;
}
