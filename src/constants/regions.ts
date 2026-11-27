/**
 * 지역 선택용 데이터 (전국).
 * 위치 권한을 허용하지 않아도 지역을 직접 골라 탐색할 수 있어야 한다(MAP-02).
 *
 * ⚠ 좌표에 대하여
 *  - 각 시·군·구의 대략적인 중심점이며, 정밀 측량값이 아니다.
 *  - 용도는 "지도 중심 이동 + 반경 검색의 기준점"뿐이므로 1~3km 오차는 기능에 영향이 없다.
 *  - 실제 공고의 위치는 등록 시 지도 클릭으로 지정한 정확한 좌표를 사용하며,
 *    거리 계산도 그 좌표로 이뤄진다.
 *  - GPS 권한을 허용하면 이 표를 거치지 않고 단말이 준 좌표를 그대로 기준점으로 쓴다.
 */
export interface Region {
  code: string;
  sido: string;
  name: string;
  lat: number;
  lng: number;
}

export const REGIONS: Region[] = [
  // ── 서울특별시 ──
  { code: '11110', sido: '서울특별시', name: '종로구', lat: 37.573, lng: 126.979 },
  { code: '11140', sido: '서울특별시', name: '중구', lat: 37.564, lng: 126.998 },
  { code: '11170', sido: '서울특별시', name: '용산구', lat: 37.532, lng: 126.99 },
  { code: '11200', sido: '서울특별시', name: '성동구', lat: 37.563, lng: 127.037 },
  { code: '11215', sido: '서울특별시', name: '광진구', lat: 37.538, lng: 127.082 },
  { code: '11230', sido: '서울특별시', name: '동대문구', lat: 37.574, lng: 127.04 },
  { code: '11260', sido: '서울특별시', name: '중랑구', lat: 37.606, lng: 127.093 },
  { code: '11290', sido: '서울특별시', name: '성북구', lat: 37.589, lng: 127.017 },
  { code: '11305', sido: '서울특별시', name: '강북구', lat: 37.64, lng: 127.026 },
  { code: '11320', sido: '서울특별시', name: '도봉구', lat: 37.669, lng: 127.047 },
  { code: '11350', sido: '서울특별시', name: '노원구', lat: 37.654, lng: 127.056 },
  { code: '11380', sido: '서울특별시', name: '은평구', lat: 37.603, lng: 126.929 },
  { code: '11410', sido: '서울특별시', name: '서대문구', lat: 37.579, lng: 126.937 },
  { code: '11440', sido: '서울특별시', name: '마포구', lat: 37.566, lng: 126.902 },
  { code: '11470', sido: '서울특별시', name: '양천구', lat: 37.517, lng: 126.867 },
  { code: '11500', sido: '서울특별시', name: '강서구', lat: 37.551, lng: 126.85 },
  { code: '11530', sido: '서울특별시', name: '구로구', lat: 37.495, lng: 126.887 },
  { code: '11545', sido: '서울특별시', name: '금천구', lat: 37.457, lng: 126.896 },
  { code: '11560', sido: '서울특별시', name: '영등포구', lat: 37.526, lng: 126.896 },
  { code: '11590', sido: '서울특별시', name: '동작구', lat: 37.512, lng: 126.939 },
  { code: '11620', sido: '서울특별시', name: '관악구', lat: 37.478, lng: 126.952 },
  { code: '11650', sido: '서울특별시', name: '서초구', lat: 37.484, lng: 127.033 },
  { code: '11680', sido: '서울특별시', name: '강남구', lat: 37.517, lng: 127.047 },
  { code: '11710', sido: '서울특별시', name: '송파구', lat: 37.515, lng: 127.106 },
  { code: '11740', sido: '서울특별시', name: '강동구', lat: 37.53, lng: 127.124 },

  // ── 경기도 ──
  { code: '41110', sido: '경기도', name: '수원시', lat: 37.263, lng: 127.029 },
  { code: '41130', sido: '경기도', name: '성남시', lat: 37.42, lng: 127.127 },
  { code: '41150', sido: '경기도', name: '의정부시', lat: 37.738, lng: 127.034 },
  { code: '41170', sido: '경기도', name: '안양시', lat: 37.394, lng: 126.957 },
  { code: '41190', sido: '경기도', name: '부천시', lat: 37.504, lng: 126.766 },
  { code: '41210', sido: '경기도', name: '광명시', lat: 37.479, lng: 126.865 },
  { code: '41220', sido: '경기도', name: '평택시', lat: 36.992, lng: 127.113 },
  { code: '41250', sido: '경기도', name: '동두천시', lat: 37.903, lng: 127.06 },
  { code: '41270', sido: '경기도', name: '안산시', lat: 37.322, lng: 126.831 },
  { code: '41280', sido: '경기도', name: '고양시', lat: 37.658, lng: 126.832 },
  { code: '41290', sido: '경기도', name: '과천시', lat: 37.429, lng: 126.988 },
  { code: '41310', sido: '경기도', name: '구리시', lat: 37.594, lng: 127.13 },
  { code: '41360', sido: '경기도', name: '남양주시', lat: 37.636, lng: 127.216 },
  { code: '41370', sido: '경기도', name: '오산시', lat: 37.15, lng: 127.077 },
  { code: '41390', sido: '경기도', name: '시흥시', lat: 37.38, lng: 126.803 },
  { code: '41410', sido: '경기도', name: '군포시', lat: 37.361, lng: 126.935 },
  { code: '41430', sido: '경기도', name: '의왕시', lat: 37.345, lng: 126.968 },
  { code: '41450', sido: '경기도', name: '하남시', lat: 37.539, lng: 127.215 },
  { code: '41460', sido: '경기도', name: '용인시', lat: 37.241, lng: 127.178 },
  { code: '41480', sido: '경기도', name: '파주시', lat: 37.76, lng: 126.78 },
  { code: '41500', sido: '경기도', name: '이천시', lat: 37.272, lng: 127.435 },
  { code: '41550', sido: '경기도', name: '안성시', lat: 37.008, lng: 127.27 },
  { code: '41570', sido: '경기도', name: '김포시', lat: 37.615, lng: 126.716 },
  { code: '41590', sido: '경기도', name: '화성시', lat: 37.199, lng: 126.831 },
  { code: '41610', sido: '경기도', name: '광주시', lat: 37.429, lng: 127.255 },
  { code: '41630', sido: '경기도', name: '양주시', lat: 37.785, lng: 127.046 },
  { code: '41650', sido: '경기도', name: '포천시', lat: 37.895, lng: 127.2 },
  { code: '41670', sido: '경기도', name: '여주시', lat: 37.298, lng: 127.637 },

  // ── 인천광역시 ──
  { code: '28110', sido: '인천광역시', name: '중구', lat: 37.474, lng: 126.622 },
  { code: '28140', sido: '인천광역시', name: '동구', lat: 37.474, lng: 126.643 },
  { code: '28177', sido: '인천광역시', name: '미추홀구', lat: 37.464, lng: 126.65 },
  { code: '28185', sido: '인천광역시', name: '연수구', lat: 37.41, lng: 126.678 },
  { code: '28200', sido: '인천광역시', name: '남동구', lat: 37.447, lng: 126.731 },
  { code: '28237', sido: '인천광역시', name: '부평구', lat: 37.507, lng: 126.721 },
  { code: '28245', sido: '인천광역시', name: '계양구', lat: 37.537, lng: 126.738 },
  { code: '28260', sido: '인천광역시', name: '서구', lat: 37.545, lng: 126.676 },

  // ── 부산광역시 ──
  { code: '26110', sido: '부산광역시', name: '중구', lat: 35.106, lng: 129.032 },
  { code: '26230', sido: '부산광역시', name: '부산진구', lat: 35.163, lng: 129.053 },
  { code: '26260', sido: '부산광역시', name: '동래구', lat: 35.205, lng: 129.084 },
  { code: '26290', sido: '부산광역시', name: '남구', lat: 35.137, lng: 129.084 },
  { code: '26380', sido: '부산광역시', name: '사하구', lat: 35.105, lng: 128.975 },
  { code: '26410', sido: '부산광역시', name: '금정구', lat: 35.243, lng: 129.092 },
  { code: '26440', sido: '부산광역시', name: '강서구', lat: 35.212, lng: 128.98 },
  { code: '26470', sido: '부산광역시', name: '연제구', lat: 35.176, lng: 129.079 },
  { code: '26500', sido: '부산광역시', name: '사상구', lat: 35.153, lng: 128.991 },
  { code: '26350', sido: '부산광역시', name: '해운대구', lat: 35.163, lng: 129.164 },

  // ── 대구광역시 ──
  { code: '27110', sido: '대구광역시', name: '중구', lat: 35.869, lng: 128.606 },
  { code: '27140', sido: '대구광역시', name: '동구', lat: 35.887, lng: 128.636 },
  { code: '27200', sido: '대구광역시', name: '남구', lat: 35.846, lng: 128.598 },
  { code: '27230', sido: '대구광역시', name: '북구', lat: 35.886, lng: 128.583 },
  { code: '27260', sido: '대구광역시', name: '수성구', lat: 35.858, lng: 128.631 },
  { code: '27290', sido: '대구광역시', name: '달서구', lat: 35.83, lng: 128.533 },

  // ── 광주광역시 ──
  { code: '29110', sido: '광주광역시', name: '동구', lat: 35.146, lng: 126.923 },
  { code: '29140', sido: '광주광역시', name: '서구', lat: 35.152, lng: 126.89 },
  { code: '29155', sido: '광주광역시', name: '남구', lat: 35.133, lng: 126.902 },
  { code: '29170', sido: '광주광역시', name: '북구', lat: 35.174, lng: 126.912 },
  { code: '29200', sido: '광주광역시', name: '광산구', lat: 35.14, lng: 126.794 },

  // ── 대전광역시 ──
  { code: '30110', sido: '대전광역시', name: '동구', lat: 36.312, lng: 127.455 },
  { code: '30140', sido: '대전광역시', name: '중구', lat: 36.325, lng: 127.421 },
  { code: '30170', sido: '대전광역시', name: '서구', lat: 36.355, lng: 127.384 },
  { code: '30200', sido: '대전광역시', name: '유성구', lat: 36.362, lng: 127.356 },
  { code: '30230', sido: '대전광역시', name: '대덕구', lat: 36.347, lng: 127.415 },

  // ── 울산광역시 ──
  { code: '31110', sido: '울산광역시', name: '중구', lat: 35.57, lng: 129.332 },
  { code: '31140', sido: '울산광역시', name: '남구', lat: 35.544, lng: 129.33 },
  { code: '31170', sido: '울산광역시', name: '동구', lat: 35.505, lng: 129.417 },
  { code: '31200', sido: '울산광역시', name: '북구', lat: 35.583, lng: 129.361 },
  { code: '31710', sido: '울산광역시', name: '울주군', lat: 35.522, lng: 129.242 },

  // ── 세종특별자치시 ──
  { code: '36110', sido: '세종특별자치시', name: '세종시', lat: 36.48, lng: 127.289 },

  // ── 강원특별자치도 ──
  { code: '51110', sido: '강원특별자치도', name: '춘천시', lat: 37.881, lng: 127.73 },
  { code: '51130', sido: '강원특별자치도', name: '원주시', lat: 37.342, lng: 127.92 },
  { code: '51150', sido: '강원특별자치도', name: '강릉시', lat: 37.752, lng: 128.876 },
  { code: '51210', sido: '강원특별자치도', name: '속초시', lat: 38.207, lng: 128.591 },

  // ── 충청북도 ──
  { code: '43110', sido: '충청북도', name: '청주시', lat: 36.642, lng: 127.489 },
  { code: '43130', sido: '충청북도', name: '충주시', lat: 36.991, lng: 127.926 },
  { code: '43150', sido: '충청북도', name: '제천시', lat: 37.133, lng: 128.191 },

  // ── 충청남도 ──
  { code: '44130', sido: '충청남도', name: '천안시', lat: 36.815, lng: 127.114 },
  { code: '44200', sido: '충청남도', name: '아산시', lat: 36.79, lng: 127.002 },
  { code: '44150', sido: '충청남도', name: '공주시', lat: 36.447, lng: 127.119 },
  { code: '44210', sido: '충청남도', name: '서산시', lat: 36.785, lng: 126.45 },
  { code: '44270', sido: '충청남도', name: '당진시', lat: 36.89, lng: 126.646 },

  // ── 전북특별자치도 ──
  { code: '52110', sido: '전북특별자치도', name: '전주시', lat: 35.824, lng: 127.148 },
  { code: '52130', sido: '전북특별자치도', name: '군산시', lat: 35.968, lng: 126.737 },
  { code: '52140', sido: '전북특별자치도', name: '익산시', lat: 35.948, lng: 126.958 },

  // ── 전라남도 ──
  { code: '46110', sido: '전라남도', name: '목포시', lat: 34.812, lng: 126.392 },
  { code: '46130', sido: '전라남도', name: '여수시', lat: 34.76, lng: 127.662 },
  { code: '46150', sido: '전라남도', name: '순천시', lat: 34.95, lng: 127.487 },
  { code: '46230', sido: '전라남도', name: '광양시', lat: 34.941, lng: 127.696 },

  // ── 경상북도 ──
  { code: '47110', sido: '경상북도', name: '포항시', lat: 36.019, lng: 129.343 },
  { code: '47130', sido: '경상북도', name: '경주시', lat: 35.856, lng: 129.225 },
  { code: '47190', sido: '경상북도', name: '구미시', lat: 36.12, lng: 128.344 },
  { code: '47170', sido: '경상북도', name: '안동시', lat: 36.568, lng: 128.73 },

  // ── 경상남도 ──
  { code: '48120', sido: '경상남도', name: '창원시', lat: 35.228, lng: 128.682 },
  { code: '48170', sido: '경상남도', name: '진주시', lat: 35.18, lng: 128.108 },
  { code: '48250', sido: '경상남도', name: '김해시', lat: 35.229, lng: 128.89 },
  { code: '48330', sido: '경상남도', name: '양산시', lat: 35.335, lng: 129.037 },
  { code: '48310', sido: '경상남도', name: '거제시', lat: 34.88, lng: 128.621 },

  // ── 제주특별자치도 ──
  { code: '50110', sido: '제주특별자치도', name: '제주시', lat: 33.499, lng: 126.531 },
  { code: '50130', sido: '제주특별자치도', name: '서귀포시', lat: 33.254, lng: 126.56 },
];

/** 샘플 데이터가 모여 있는 기본 지역 (서울 강서구) */
export const DEFAULT_REGION = REGIONS.find((r) => r.code === '11500')!;

/** 시·도별로 묶은 목록 — <optgroup> 렌더링용 */
export const REGION_GROUPS: { sido: string; regions: Region[] }[] = (() => {
  const map = new Map<string, Region[]>();
  for (const region of REGIONS) {
    const list = map.get(region.sido);
    if (list) list.push(region);
    else map.set(region.sido, [region]);
  }
  return [...map.entries()].map(([sido, regions]) => ({ sido, regions }));
})();

export function findRegion(code: string | null | undefined): Region {
  return REGIONS.find((r) => r.code === code) ?? DEFAULT_REGION;
}

export function regionLabel(region: Region): string {
  return `${region.sido.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')} ${region.name}`;
}

/**
 * 좌표에서 가장 가까운 등록 지역을 찾는다.
 * maxKm를 넘으면 null을 돌려준다 — 목록에 없는 지역의 사용자를
 * 엉뚱한 지역으로 표시하지 않기 위함이다.
 */
export function nearestRegion(lat: number, lng: number, maxKm = 20): Region | null {
  let best: Region | null = null;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const r of REGIONS) {
    // 위경도 1도의 거리 차이를 보정한 간이 거리(충분히 정확함)
    const dLat = (r.lat - lat) * 111;
    const dLng = (r.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180);
    const km = Math.sqrt(dLat * dLat + dLng * dLng);
    if (km < bestKm) {
      bestKm = km;
      best = r;
    }
  }
  return bestKm <= maxKm ? best : null;
}

export const RADIUS_OPTIONS = [
  { value: 1000, label: '1km' },
  { value: 3000, label: '3km' },
  { value: 5000, label: '5km' },
  { value: 10000, label: '10km' },
  { value: 20000, label: '20km' },
];
