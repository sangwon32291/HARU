# 행정 경계 데이터 (선택 사항)

HaruMap은 경계 데이터 없이도 정상 동작합니다(위경도 격자 + 마커).
행정동 경계를 함께 보이게 하려면 이 폴더에 `boundaries.geojson` 파일을 두면 됩니다.
파일이 없으면 지도는 조용히 격자 배경만 그립니다. 오류가 나지 않습니다.

## 요구 형식

- GeoJSON `FeatureCollection`
- 좌표계 **WGS84 (EPSG:4326)**, 즉 `[경도, 위도]` 순서
- `Polygon` 또는 `MultiPolygon` 지오메트리
- 인코딩 UTF-8

## 데이터 출처 예시

| 출처 | 설명 | 라이선스 |
|---|---|---|
| 공공데이터포털 — 국토교통부 행정구역도(시도/시군구/읍면동) | 오픈 API로 행정구역 도형·속성 제공 | 공공저작물 출처표시 |
| `vuski/admdongkor` (GitHub) | 대한민국 행정동 경계 GeoJSON, WGS84, UTF-8 | 리포지토리 라이선스 확인 |

## 용량 줄이기 (권장)

원본은 수 MB에 달할 수 있습니다. `mapshaper`로 대상 지역만 추출하고 단순화하십시오.

```bash
npx mapshaper 원본.geojson \
  -filter '(sggnm || "").indexOf("강서") > -1' \
  -simplify 5% \
  -o format=geojson precision=0.00001 public/geo/boundaries.geojson
```

목표 용량: 200KB 이하. 빌드 시 정적 파일로 포함되므로 런타임 외부 요청이 발생하지 않습니다.

## 출처 표기

공공데이터를 사용하는 경우 서비스 하단(푸터)에 출처를 표기해야 합니다.
`src/components/layout/AppLayout.tsx` 의 푸터에 표기 자리를 마련해 두었습니다.
