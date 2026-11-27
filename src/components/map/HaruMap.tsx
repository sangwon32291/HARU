/**
 * HaruMap — 외부 지도 API 없이 직접 구현한 지도 컴포넌트.
 *
 * 왜 자체 구현인가
 *  - 카카오/네이버 지도 API는 앱 키·도메인 등록·일일 쿼터 제약이 있어
 *    팀원 4명이 각자 환경에서 개발할 때 "키가 없어서 화면이 안 뜨는" 문제가 생긴다.
 *  - HARU는 좌표 기반 거리 계산과 마커 탐색이 핵심이므로,
 *    Web Mercator 투영을 직접 구현하면 외부 의존 없이 요구사항을 충족할 수 있다.
 *
 * 구성
 *  - 투영: lib/geo.ts 의 project / unproject (Web Mercator)
 *  - 베이스: OpenStreetMap 래스터 타일 (도로·건물·역 등 실제 지형지물)
 *            → 타일을 못 받으면 자동으로 위경도 격자 배경으로 대체된다.
 *  - 오버레이: 반경 원, 기준점, 공고 마커(픽셀 격자 클러스터링)
 *  - 상호작용: 드래그 이동, 휠·버튼 줌, 클릭으로 좌표 선택(pick 모드)
 *
 * 타일에 대하여
 *  - 도로·건물 형상은 코드로 생성할 수 없는 측량 데이터이므로 오픈 데이터를 배경으로 쓴다.
 *  - 투영 계산, 타일 배치, 클러스터링, 거리 계산, 좌표 선택은 모두 이 파일의 자체 구현이다.
 *  - OSM 타일 이용 정책 준수 사항:
 *      · https URL 사용 (https://tile.openstreetmap.org/{z}/{x}/{y}.png)
 *      · 지도 위에 저작자 표시를 명확히 노출 (우측 하단)
 *      · 화면에 실제로 보이는 타일만 요청 (사전 대량 수집·오프라인 저장 금지)
 *  - 타일 주소는 TILE_URL 한 줄이므로, 나중에 카카오/VWorld 등으로 교체하기 쉽다.
 *
 * 남은 한계: 주소→좌표 변환(지오코딩)은 제공하지 않으며,
 * 공고 등록 시 지도를 클릭해 좌표를 지정하는 방식으로 대체한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Minus, Plus } from 'lucide-react';
import { metersPerPixel, project, unproject, type LatLng } from '@/lib/geo';
import { cn } from '@/lib/format';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  tone?: 'default' | 'selected' | 'muted';
}

interface Size {
  width: number;
  height: number;
}

export interface HaruMapProps {
  center: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  selectedId?: string | null;
  radiusM?: number | null;
  /** true면 지도를 클릭해 좌표를 선택할 수 있다 (공고 등록용) */
  pickMode?: boolean;
  pickedPoint?: LatLng | null;
  onPick?: (point: LatLng) => void;
  onMarkerClick?: (id: string) => void;
  onRecenter?: () => void;
  className?: string;
  /** 기준점 표시 여부 (내 위치/지역 중심) */
  showOrigin?: boolean;
}

const MIN_ZOOM = 10;
const MAX_ZOOM = 18;
const TILE_SIZE = 256;

/** 배경 타일 주소. 다른 지도 제공자로 바꾸려면 이 한 줄만 교체하면 된다. */
const TILE_URL = (z: number, x: number, y: number) =>
  `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
const TILE_MAX_Z = 19;

/** 줌 레벨별 격자 간격(도). 화면에 6~10개 선이 보이도록 조정된 값. */
function gridStep(zoom: number): number {
  if (zoom >= 15) return 0.005;
  if (zoom >= 14) return 0.01;
  if (zoom >= 13) return 0.02;
  if (zoom >= 12) return 0.05;
  return 0.1;
}

interface GeoFeatureCollection {
  type: string;
  features: { geometry: { type: string; coordinates: unknown }; properties?: Record<string, unknown> }[];
}

export function HaruMap({
  center,
  zoom: zoomProp = 13,
  markers = [],
  selectedId = null,
  radiusM = null,
  pickMode = false,
  pickedPoint = null,
  onPick,
  onMarkerClick,
  onRecenter,
  className,
  showOrigin = true,
}: HaruMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(zoomProp);
  const [viewCenter, setViewCenter] = useState<LatLng>(center);
  const [boundary, setBoundary] = useState<GeoFeatureCollection | null>(null);
  /** 타일 서버에 접근하지 못하면(오프라인·차단) 격자 배경으로 자동 대체한다 */
  const [tileError, setTileError] = useState(false);

  const dragState = useRef<{ x: number; y: number; moved: number; dragging: boolean }>({
    x: 0,
    y: 0,
    moved: 0,
    dragging: false,
  });

  /* 부모가 중심/줌을 바꾸면 따라간다 */
  useEffect(() => setViewCenter(center), [center.lat, center.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setZoom(zoomProp), [zoomProp]);

  /* 크기 측정 */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* 행정 경계 데이터(선택). 없으면 격자만으로 동작한다. */
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}geo/boundaries.geojson`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json && json.features) setBoundary(json as GeoFeatureCollection);
      })
      .catch(() => {
        /* 경계 파일이 없으면 무시한다 (README 참고) */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const originPx = useMemo(() => {
    const c = project(viewCenter.lat, viewCenter.lng, zoom);
    return { x: c.x - size.width / 2, y: c.y - size.height / 2 };
  }, [viewCenter, zoom, size.width, size.height]);

  const toScreen = useCallback(
    (lat: number, lng: number) => {
      const p = project(lat, lng, zoom);
      return { x: p.x - originPx.x, y: p.y - originPx.y };
    },
    [originPx, zoom],
  );

  const fromScreen = useCallback(
    (x: number, y: number) => unproject(x + originPx.x, y + originPx.y, zoom),
    [originPx, zoom],
  );

  /* ── 상호작용 ── */

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragState.current = { x: e.clientX, y: e.clientY, moved: 0, dragging: true };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const st = dragState.current;
    if (!st.dragging) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    st.moved += Math.abs(dx) + Math.abs(dy);
    st.x = e.clientX;
    st.y = e.clientY;

    const c = project(viewCenter.lat, viewCenter.lng, zoom);
    setViewCenter(unproject(c.x - dx, c.y - dy, zoom));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const st = dragState.current;
    st.dragging = false;
    if (st.moved < 5 && pickMode && onPick) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) onPick(fromScreen(e.clientX - rect.left, e.clientY - rect.top));
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
  };

  /* ── 렌더 데이터 ── */

  const mpp = metersPerPixel(viewCenter.lat, zoom);
  const radiusPx = radiusM ? radiusM / mpp : 0;
  const originScreen = toScreen(center.lat, center.lng);

  /** 픽셀 격자 기반 클러스터링 */
  const clusters = useMemo(() => {
    const CELL = 62;
    const map = new Map<string, { x: number; y: number; items: MapMarker[] }>();
    for (const m of markers) {
      const s = toScreen(m.lat, m.lng);
      if (s.x < -80 || s.y < -80 || s.x > size.width + 80 || s.y > size.height + 80) continue;
      const key = `${Math.floor(s.x / CELL)}:${Math.floor(s.y / CELL)}`;
      const found = map.get(key);
      if (found) {
        found.items.push(m);
        found.x = (found.x * (found.items.length - 1) + s.x) / found.items.length;
        found.y = (found.y * (found.items.length - 1) + s.y) / found.items.length;
      } else {
        map.set(key, { x: s.x, y: s.y, items: [m] });
      }
    }
    return [...map.values()];
  }, [markers, toScreen, size.width, size.height]);

  const gridLines = useMemo(() => {
    if (size.width === 0) return { vertical: [] as number[], horizontal: [] as number[] };
    const step = gridStep(zoom);
    const topLeft = fromScreen(0, 0);
    const bottomRight = fromScreen(size.width, size.height);
    const vertical: number[] = [];
    const horizontal: number[] = [];
    for (let lng = Math.floor(topLeft.lng / step) * step; lng < bottomRight.lng; lng += step) {
      vertical.push(toScreen(topLeft.lat, lng).x);
    }
    for (let lat = Math.ceil(topLeft.lat / step) * step; lat > bottomRight.lat; lat -= step) {
      horizontal.push(toScreen(lat, topLeft.lng).y);
    }
    return { vertical, horizontal };
  }, [zoom, size.width, size.height, fromScreen, toScreen]);

  const boundaryPaths = useMemo(() => {
    if (!boundary || size.width === 0) return [] as string[];
    const paths: string[] = [];
    const ringToPath = (ring: number[][]) => {
      let d = '';
      for (let i = 0; i < ring.length; i += 1) {
        const [lng, lat] = ring[i];
        const s = toScreen(lat, lng);
        d += `${i === 0 ? 'M' : 'L'}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
      }
      return `${d}Z`;
    };
    for (const feature of boundary.features) {
      const { type, coordinates } = feature.geometry;
      if (type === 'Polygon') {
        for (const ring of coordinates as number[][][]) paths.push(ringToPath(ring));
      } else if (type === 'MultiPolygon') {
        for (const polygon of coordinates as number[][][][]) {
          for (const ring of polygon) paths.push(ringToPath(ring));
        }
      }
    }
    return paths;
  }, [boundary, toScreen, size.width]);

  /**
   * 화면에 보이는 타일 목록을 계산한다.
   * 줌이 소수일 수 있으므로(예: 13.4) 가장 가까운 정수 줌의 타일을 가져와
   * scale 배율로 늘려 붙인다. 보이는 범위의 타일만 만든다(정책상 사전 수집 금지).
   */
  const tiles = useMemo(() => {
    if (size.width === 0 || tileError) return [];
    const tileZ = Math.max(0, Math.min(TILE_MAX_Z, Math.round(zoom)));
    const scaleFactor = 2 ** (zoom - tileZ);
    const tilePx = TILE_SIZE * scaleFactor;
    const count = 2 ** tileZ;

    const minX = Math.floor(originPx.x / tilePx);
    const maxX = Math.floor((originPx.x + size.width) / tilePx);
    const minY = Math.floor(originPx.y / tilePx);
    const maxY = Math.floor((originPx.y + size.height) / tilePx);

    const list: { key: string; url: string; left: number; top: number; size: number }[] = [];
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        if (y < 0 || y >= count) continue; // 극지방 바깥
        const wrappedX = ((x % count) + count) % count; // 경도 180도 넘김 처리
        list.push({
          key: `${tileZ}/${x}/${y}`,
          url: TILE_URL(tileZ, wrappedX, y),
          left: x * tilePx - originPx.x,
          top: y * tilePx - originPx.y,
          size: tilePx,
        });
      }
    }
    return list;
  }, [zoom, originPx, size.width, size.height, tileError]);

  const showGrid = tileError || tiles.length === 0;

  /** 축척 막대: 60~140px 사이에 들어오는 깔끔한 거리 단위를 고른다 */
  const scale = useMemo(() => {
    const candidates = [50, 100, 200, 300, 500, 1000, 2000, 3000, 5000];
    for (const m of candidates) {
      const px = m / mpp;
      if (px >= 60 && px <= 140) return { meters: m, px };
    }
    return { meters: 1000, px: 1000 / mpp };
  }, [mpp]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative select-none overflow-hidden rounded-2xl border border-haru-border bg-[#EEF4EF]',
        pickMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing',
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        dragState.current.dragging = false;
      }}
      onWheel={handleWheel}
      role="application"
      aria-label="주변 일자리 지도"
    >
      {/* 베이스 타일 (OpenStreetMap). 보이는 범위만 요청한다. */}
      {!showGrid && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {tiles.map((tile) => (
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              draggable={false}
              loading="lazy"
              onError={() => setTileError(true)}
              style={{
                position: 'absolute',
                left: tile.left,
                top: tile.top,
                width: tile.size,
                height: tile.size,
              }}
            />
          ))}
        </div>
      )}

      <svg width={size.width} height={size.height} className="absolute inset-0">
        <defs>
          <linearGradient id="haru-map-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F2F7F3" />
            <stop offset="100%" stopColor="#E7F0E9" />
          </linearGradient>
        </defs>

        {/* 타일을 쓰지 못할 때만 배경과 격자를 그린다 */}
        {showGrid && (
          <>
            <rect width={size.width} height={size.height} fill="url(#haru-map-bg)" />
            <g stroke="#CFDED4" strokeWidth={1}>
              {gridLines.vertical.map((x, i) => (
                <line key={`v${i}`} x1={x} y1={0} x2={x} y2={size.height} />
              ))}
              {gridLines.horizontal.map((y, i) => (
                <line key={`h${i}`} x1={0} y1={y} x2={size.width} y2={y} />
              ))}
            </g>
          </>
        )}

        {/* 행정 경계 (파일이 있을 때만) */}
        {boundaryPaths.length > 0 && (
          <g
            fill={showGrid ? '#FFFFFF' : 'none'}
            fillOpacity={showGrid ? 0.55 : 0}
            stroke="#2E8B57"
            strokeOpacity={0.45}
            strokeWidth={1.2}
          >
            {boundaryPaths.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        )}

        {/* 반경 원 */}
        {radiusPx > 0 && (
          <circle
            cx={originScreen.x}
            cy={originScreen.y}
            r={radiusPx}
            fill="#2E8B57"
            fillOpacity={0.07}
            stroke="#2E8B57"
            strokeOpacity={0.45}
            strokeDasharray="6 5"
            strokeWidth={1.5}
          />
        )}

        {/* 기준점 */}
        {showOrigin && (
          <g>
            <circle cx={originScreen.x} cy={originScreen.y} r={11} fill="#2E8B57" fillOpacity={0.18} />
            <circle cx={originScreen.x} cy={originScreen.y} r={5} fill="#2E8B57" stroke="#fff" strokeWidth={2} />
          </g>
        )}

        {/* 선택한 좌표 (공고 등록) */}
        {pickedPoint && (
          <g transform={`translate(${toScreen(pickedPoint.lat, pickedPoint.lng).x}, ${toScreen(pickedPoint.lat, pickedPoint.lng).y})`}>
            <path d="M0 0 L-8 -14 A9 9 0 1 1 8 -14 Z" fill="#D14343" stroke="#fff" strokeWidth={1.5} />
            <circle cx={0} cy={-19} r={3.2} fill="#fff" />
          </g>
        )}
      </svg>

      {/* 마커 오버레이 (HTML) */}
      <div className="pointer-events-none absolute inset-0">
        {clusters.map((cluster) => {
          const isCluster = cluster.items.length > 1;
          const first = cluster.items[0];
          const selected = cluster.items.some((m) => m.id === selectedId);
          return (
            <button
              key={isCluster ? `cl-${cluster.x.toFixed(0)}-${cluster.y.toFixed(0)}` : first.id}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (isCluster) {
                  setViewCenter({ lat: first.lat, lng: first.lng });
                  setZoom((z) => Math.min(MAX_ZOOM, z + 2));
                } else {
                  onMarkerClick?.(first.id);
                }
              }}
              style={{ left: cluster.x, top: cluster.y }}
              className={cn(
                'pointer-events-auto absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold shadow-card transition-transform hover:-translate-y-[115%]',
                isCluster
                  ? 'border-haru-primary bg-haru-primary text-white'
                  : selected
                    ? 'border-haru-primary bg-haru-primary text-white'
                    : first.tone === 'muted'
                      ? 'border-haru-border bg-white/90 text-haru-sub'
                      : 'border-haru-border bg-white text-haru-text',
              )}
              aria-label={isCluster ? `공고 ${cluster.items.length}건 모여 있음` : first.label}
            >
              {isCluster ? `${cluster.items.length}건` : first.label}
            </button>
          );
        })}
      </div>

      {/* 컨트롤 */}
      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-haru-border bg-white text-haru-text shadow-card hover:bg-haru-bg"
          aria-label="확대"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-haru-border bg-white text-haru-text shadow-card hover:bg-haru-bg"
          aria-label="축소"
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            setViewCenter(center);
            onRecenter?.();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-haru-border bg-white text-haru-primary shadow-card hover:bg-haru-bg"
          aria-label="기준 위치로 이동"
        >
          <Crosshair className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* 축척 */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-end gap-2">
        <div className="rounded-md bg-white/85 px-2 py-1 text-xs font-medium text-haru-sub shadow-sm">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block border-b-2 border-l-2 border-r-2 border-haru-sub/70"
              style={{ width: scale.px, height: 5 }}
            />
            <span>{scale.meters >= 1000 ? `${scale.meters / 1000}km` : `${scale.meters}m`}</span>
          </div>
        </div>
      </div>

      {pickMode && (
        <div className="pointer-events-none absolute inset-x-3 top-3 rounded-lg bg-haru-text/85 px-3 py-2 text-center text-xs font-medium text-white">
          지도를 눌러 근무 위치를 지정하세요
        </div>
      )}

      {/* 저작자 표시 — OSM 타일 이용 정책상 필수 */}
      <div className="absolute bottom-0 right-0 rounded-tl-md bg-white/80 px-1.5 py-0.5 text-xs leading-tight text-haru-sub">
        {showGrid ? (
          <span>좌표 격자 모드</span>
        ) : (
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer noopener"
            onPointerDown={(e) => e.stopPropagation()}
            className="hover:underline"
          >
            © OpenStreetMap 기여자
          </a>
        )}
      </div>

      {size.width === 0 && <div className="absolute inset-0 animate-pulse bg-haru-border/40" />}
    </div>
  );
}
