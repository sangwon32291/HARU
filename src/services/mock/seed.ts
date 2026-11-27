/**
 * 샘플 데이터 생성기 (mock 모드 전용).
 *
 * - 결정적 난수(seeded PRNG)를 쓰므로 새로고침해도 같은 데이터가 생성된다.
 * - **전국 모든 등록 지역**(constants/regions.ts)에 공고를 분산 생성한다.
 *   한 지역에만 몰아두면 다른 지역 사용자가 빈 화면을 보게 되기 때문이다.
 * - 각 공고의 좌표는 지역 중심에서 반경 약 2~3km 안에 흩어진다.
 * - Supabase 전환 시 supabase/seed.sql 이 같은 구조의 데이터를 적재한다.
 */
import type { JobCategory } from '@/types/enums';
import { JOB_CATEGORY } from '@/types/enums';
import type {
  CommunityComment,
  CommunityPost,
  JobApplication,
  JobPost,
  Profile,
  Review,
} from '@/types/database';
import { REGIONS, type Region } from '@/constants/regions';
import { addDays, toDateInput } from '@/lib/format';

export interface MockAccount {
  id: string;
  email: string;
  password: string;
}

export interface SeedData {
  accounts: MockAccount[];
  profiles: Profile[];
  jobPosts: JobPost[];
  applications: JobApplication[];
  reviews: Review[];
  posts: CommunityPost[];
  comments: CommunityComment[];
  likes: { id: string; postId: string; userId: string; createdAt: string }[];
  reports: [];
}

/** mulberry32 — 작고 결정적인 PRNG */
function createRandom(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 구인 업체(인력사무소·업장) 계정.
 * HARU는 인력사무소 성격이라 한 업체가 여러 지역의 현장을 다루는 것이 자연스럽다.
 * 업체 수를 적정하게 유지해야 리뷰가 모여 평점이 의미 있게 쌓인다.
 */
const EMPLOYERS = [
  { nickname: '한결인력', suffix: '인력사무소' },
  { nickname: '대성물류', suffix: '물류센터' },
  { nickname: '우리푸드', suffix: '푸드서비스' },
  { nickname: '미소카페', suffix: '카페' },
  { nickname: '튼튼건설', suffix: '건설' },
  { nickname: '행복마트', suffix: '마트' },
  { nickname: '새벽이사', suffix: '종합이사' },
  { nickname: '이벤트웍스', suffix: '이벤트' },
  { nickname: '청정클린', suffix: '클린서비스' },
  { nickname: '바른사무', suffix: '사무지원' },
  { nickname: '신속배송', suffix: '배송' },
  { nickname: '으뜸주방', suffix: '주방' },
];

const SEEKERS = [
  '성실한하루',
  '김알바',
  '주말에만',
  '야간러',
  '손이빠른',
  '체력왕',
  '초보지만',
  '열정만렙',
  '부지런한곰',
  '하루하루',
  '단기전문',
  '꼼꼼한손',
];

/** 지역명과 결합해 쓰는 장소 표현. 전국 어디서나 자연스럽게 읽힌다. */
const PLACE_SUFFIX = [
  '중앙시장 입구',
  '시외버스터미널 앞',
  '우체국 사거리',
  '종합운동장 주차장',
  '하나로마트 앞',
  '보건소 맞은편',
  '문화회관 앞',
  '도서관 버스정류장',
  '산업단지 정문',
  '물류센터 하차장',
  '행정복지센터 앞',
  '공영주차장 입구',
  '역 1번 출구 앞',
  '사거리 농협 앞',
];

const JOB_TEMPLATES: Record<JobCategory, { title: string; desc: string; req: string; belong: string }[]> = {
  logistics: [
    {
      title: '택배 상하차 보조 (단기)',
      desc: '컨베이어로 내려오는 택배 상자를 지역별로 분류하고 롤테이너에 적재하는 업무입니다. 2인 1조로 진행하며 중간 휴식 2회가 있습니다.',
      req: '18세 이상 / 반복 동작 가능하신 분',
      belong: '편한 복장, 장갑(현장 지급 가능), 안전화 권장',
    },
    {
      title: '물류창고 피킹·포장',
      desc: 'PDA로 상품 위치를 확인해 집품하고 박스 포장까지 담당합니다. 실내 근무이며 냉난방이 됩니다.',
      req: '경력 무관 / 성실하신 분',
      belong: '신분증, 편한 운동화',
    },
    {
      title: '새벽 분류 작업 (단기)',
      desc: '새벽 시간대 물량 분류 작업입니다. 작업량에 따라 조기 종료될 수 있으며 종료 시각과 무관하게 약정 금액을 지급합니다.',
      req: '새벽 출근 가능하신 분',
      belong: '편한 복장, 보온 의류(겨울)',
    },
  ],
  serving: [
    {
      title: '점심 피크타임 홀서빙',
      desc: '11시 30분부터 14시까지 주문 받기, 음식 서빙, 테이블 정리를 담당합니다. 식사 제공됩니다.',
      req: '친절한 응대 가능하신 분',
      belong: '검정 하의, 운동화',
    },
    {
      title: '주말 저녁 홀 서빙',
      desc: '주말 저녁 손님이 몰리는 시간대 홀 업무입니다. 포스 사용은 알려드립니다.',
      req: '주말 근무 가능하신 분',
      belong: '단정한 복장, 편한 신발',
    },
  ],
  kitchen: [
    {
      title: '주방 보조 (설거지·재료 손질)',
      desc: '식자재 다듬기와 식기 세척을 담당합니다. 조리 경험이 없어도 알려드립니다.',
      req: '위생 수칙 준수 가능하신 분',
      belong: '앞치마(지급), 편한 복장',
    },
    {
      title: '단체급식 조리 보조',
      desc: '구내식당 배식 준비와 조리 보조, 정리 업무입니다. 식사 제공됩니다.',
      req: '경력 무관',
      belong: '위생모(지급), 미끄럼 방지 신발',
    },
  ],
  cafe: [
    {
      title: '주말 카페 홀·음료 보조',
      desc: '음료 제조 보조, 매장 정리, 간단한 베이커리 데우기 업무입니다. 바리스타 교육 가능합니다.',
      req: '주말 양일 근무 가능하신 분 우대',
      belong: '흰 상의, 검정 하의',
    },
    {
      title: '베이커리 진열·포장',
      desc: '구워져 나온 빵을 진열하고 포장하는 업무입니다. 오전 시간대 근무입니다.',
      req: '오전 출근 가능하신 분',
      belong: '편한 복장, 위생모(지급)',
    },
  ],
  delivery: [
    {
      title: '지역 배송 보조 (동승)',
      desc: '배송 차량에 동승해 물품 하차와 전달을 돕습니다. 운전은 하지 않습니다.',
      req: '무거운 물건 운반 가능하신 분',
      belong: '편한 복장, 장갑',
    },
  ],
  construction: [
    {
      title: '현장 정리 및 자재 운반',
      desc: '공사 현장 폐자재 정리와 자재 운반 보조 업무입니다. 안전교육 후 투입됩니다.',
      req: '안전 수칙 준수 / 19세 이상',
      belong: '안전화 필수, 작업복',
    },
    {
      title: '건물 외벽 보수 보조',
      desc: '외벽 보수 작업의 자재 전달과 현장 정리를 담당합니다. 고소 작업은 하지 않습니다.',
      req: '안전교육 이수 가능하신 분',
      belong: '안전화, 작업복, 장갑',
    },
  ],
  event: [
    {
      title: '행사 안내 스태프',
      desc: '행사장 입구 안내, 명찰 배부, 동선 안내를 담당합니다. 단체복이 제공됩니다.',
      req: '장시간 서서 근무 가능하신 분',
      belong: '검정 하의, 편한 신발',
    },
    {
      title: '축제 부스 설치·철거',
      desc: '행사 부스 설치와 철거, 물품 운반을 담당합니다. 2인 1조로 진행합니다.',
      req: '경력 무관 / 체력 보통 이상',
      belong: '편한 복장, 장갑',
    },
  ],
  mart: [
    {
      title: '마트 진열 및 재고 정리',
      desc: '입고 상품 진열, 유통기한 확인, 매대 정리 업무입니다.',
      req: '경력 무관',
      belong: '편한 복장',
    },
    {
      title: '주말 계산대 보조',
      desc: '계산대 포장 보조와 장바구니 정리를 담당합니다. 계산은 직원이 합니다.',
      req: '주말 근무 가능하신 분',
      belong: '단정한 복장',
    },
  ],
  cleaning: [
    {
      title: '사무실 입주 청소',
      desc: '신규 입주 사무실의 바닥, 창틀, 집기 청소를 진행합니다. 청소 도구는 전부 제공됩니다.',
      req: '경력 무관 / 꼼꼼하신 분',
      belong: '편한 복장, 여벌 옷',
    },
    {
      title: '행사 후 현장 정리',
      desc: '행사 종료 후 쓰레기 수거와 바닥 청소를 담당합니다.',
      req: '경력 무관',
      belong: '편한 복장, 장갑',
    },
  ],
  office: [
    {
      title: '서류 스캔·정리 사무보조',
      desc: '문서 스캔, 파일 정리, 간단한 엑셀 입력을 담당합니다. 실내 좌식 업무입니다.',
      req: '기본적인 컴퓨터 사용 가능하신 분',
      belong: '단정한 복장',
    },
    {
      title: '설문 자료 입력',
      desc: '수기 설문지를 엑셀 양식에 입력하는 업무입니다. 타자 속도가 빠르면 좋습니다.',
      req: '엑셀 기본 사용 가능하신 분',
      belong: '신분증',
    },
  ],
  etc: [
    {
      title: '전단 배포 및 홍보 보조',
      desc: '지정 구역에서 전단을 배포하고 간단한 안내를 합니다.',
      req: '경력 무관',
      belong: '편한 신발',
    },
    {
      title: '창고 재고 조사 보조',
      desc: '창고 물품 수량을 확인하고 기록지에 기입하는 업무입니다.',
      req: '숫자 확인이 꼼꼼하신 분',
      belong: '편한 복장, 필기구',
    },
  ],
};

const COMMUNITY_SEED = [
  {
    category: 'caution' as const,
    title: '공고에 적힌 시간보다 2시간 더 시킨 곳 후기',
    content:
      '어제 다녀온 현장 공유합니다. 공고에는 6시간이라고 적혀 있었는데 실제로는 8시간 가까이 진행됐습니다. 추가 시간분은 결국 정산받았지만, 미리 물어보지 않으면 그냥 넘어갈 뻔했습니다.\n\n현장 도착하면 담당자에게 종료 시간을 먼저 확인하고, 연장될 경우 어떻게 계산되는지 문자로 남겨두는 걸 추천합니다.',
  },
  {
    category: 'info' as const,
    title: '일용직 처음 하는 분들을 위한 체크리스트',
    content:
      '몇 달 하면서 정리한 내용입니다.\n\n1. 신분증은 무조건 챙기기 (없으면 돌려보내는 곳 있습니다)\n2. 식사 제공 여부 미리 확인\n3. 급여 지급일 꼭 확인 — 당일 지급인지 익일인지\n4. 현장 주소와 실제 집합 장소가 다른 경우가 있으니 전날 연락 한 번\n5. 장갑은 본인 것 챙기면 편합니다',
  },
  {
    category: 'review' as const,
    title: '물류센터 단기 3일 다녀온 후기',
    content:
      '생각보다 할 만했습니다. 2인 1조라 혼자 무거운 걸 드는 일은 거의 없었고, 2시간마다 쉬는 시간이 있었습니다. 다만 첫날은 손목이 좀 아팠습니다.\n\n급여는 공고대로 다음 날 입금됐습니다. 담당자분도 설명을 자세히 해주셔서 처음 하는 분도 괜찮을 것 같습니다.',
  },
  {
    category: 'free' as const,
    title: '다들 하루 일당 받으면 어디에 쓰시나요',
    content: '오늘 일당 받았는데 괜히 기분이 좋네요. 다들 어떻게 관리하시는지 궁금합니다.',
  },
  {
    category: 'info' as const,
    title: '단기 알바 공고 많이 올라오는 요일',
    content:
      '체감상 목요일 저녁~금요일 오전에 주말 건이 제일 많이 올라옵니다. 물류 쪽은 월초에 몰리는 편이고, 행사 스태프는 주말 직전에 급하게 올라오는 경우가 많습니다.',
  },
  {
    category: 'caution' as const,
    title: '면접 보러 오라면서 교통비도 안 주는 곳',
    content:
      '단기 알바인데 사전 면접을 요구하는 곳이 있었습니다. 왕복 1시간 거리였는데 결국 채용도 안 됐습니다. 단기 건은 전화 면접으로 충분한 경우가 대부분이라고 생각합니다.',
  },
  {
    category: 'info' as const,
    title: '지방에서 단기 알바 구할 때 팁',
    content:
      '수도권보다 공고 수가 적은 대신 경쟁도 덜합니다. 산업단지나 물류센터가 있는 지역은 꾸준히 물량이 나오니 반경을 10~20km로 넓혀서 보시는 걸 추천합니다.',
  },
  {
    category: 'review' as const,
    title: '행사 스태프 처음 해봤는데 생각보다 괜찮았어요',
    content:
      '하루 8시간 서 있는 게 힘들긴 했지만 분위기가 좋았습니다. 단체복도 주고 식사도 제공해줘서 만족합니다. 다만 신발은 꼭 편한 걸로 신으세요.',
  },
];

const REVIEW_CONTENTS = [
  '공고에 적힌 내용과 실제 업무가 거의 같았습니다. 담당자분이 처음에 동선을 설명해주셔서 헤매지 않았습니다. 급여도 다음 날 바로 입금됐습니다.',
  '업무 강도는 조금 있는 편이지만 쉬는 시간을 제대로 챙겨주셨습니다. 다시 부르시면 또 갈 생각입니다.',
  '생각보다 사람이 적게 와서 일이 몰렸습니다. 급여는 정확히 지급됐지만 인원 관리는 아쉬웠습니다.',
  '실내라 날씨 영향이 없어서 좋았고, 식사도 제공해주셨습니다. 초보자도 할 만합니다.',
  '전반적으로 무난했습니다. 다만 집합 장소 안내가 조금 헷갈려서 10분 정도 헤맸습니다.',
  '현장 분위기가 좋았습니다. 중간에 음료도 나눠주셔서 끝까지 할 만했습니다.',
  '처음이라 걱정했는데 옆에서 계속 알려주셔서 금방 적응했습니다. 추천합니다.',
  '일 자체는 단순한데 반복이 많아 지루할 수 있습니다. 급여 지급은 깔끔했습니다.',
];

const COMMENT_SEED = [
  '좋은 정보 감사합니다. 저도 다음 주에 비슷한 현장 갑니다.',
  '저도 같은 경험 있습니다. 미리 확인하는 게 정말 중요하더라고요.',
  '혹시 그 현장 담당자분 성함 아시나요? 비슷한 공고 보고 있어서요.',
  '정리 깔끔하네요. 처음 하는 분들께 도움 될 것 같습니다.',
  '공감합니다. 저는 그래서 문자로 꼭 남겨둡니다.',
  '지방도 요즘 공고 꽤 올라오더라고요. 참고하겠습니다.',
];

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function roundPay(value: number, unit: number): number {
  return Math.round(value / unit) * unit;
}

/**
 * 지역별 급여 보정.
 * 수도권·광역시는 평균 급여가 높고 그 외 지역은 조금 낮게 잡아, 지역을 바꿔
 * 탐색했을 때 결과가 단조롭지 않도록 한다. (실측치가 아닌 시연용 가중치)
 */
function payFactor(region: Region): number {
  if (region.sido === '서울특별시') return 1.06;
  if (region.sido === '경기도' || region.sido === '인천광역시') return 1.02;
  if (region.sido.endsWith('광역시') || region.sido === '세종특별자치시') return 1.0;
  return 0.95;
}

export function createSeedData(): SeedData {
  const rand = createRandom(20261106);
  const now = new Date();
  const nowIso = now.toISOString();

  const profiles: Profile[] = [];
  const accounts: MockAccount[] = [];

  const makeProfile = (
    idx: number,
    nickname: string,
    role: 'user' | 'admin',
    bio: string | null,
    region: Region,
  ): Profile => ({
    id: `u${String(idx).padStart(3, '0')}`,
    nickname,
    phone: `010-${String(1000 + Math.floor(rand() * 8999))}-${String(1000 + Math.floor(rand() * 8999))}`,
    bio,
    avatarUrl: null,
    regionCode: region.code,
    baseLat: region.lat,
    baseLng: region.lng,
    ratingAvg: 0,
    reviewCount: 0,
    role,
    createdAt: new Date(now.getTime() - (60 + idx) * 86_400_000).toISOString(),
  });

  const seoulGangseo = REGIONS.find((r) => r.code === '11500')!;

  let idx = 1;
  const employerIds: string[] = [];
  for (const e of EMPLOYERS) {
    const p = makeProfile(idx, e.nickname, 'user', `전국 현장을 운영하는 ${e.nickname}입니다.`, seoulGangseo);
    profiles.push(p);
    accounts.push({ id: p.id, email: `employer${idx}@haru.test`, password: 'haru1234' });
    employerIds.push(p.id);
    idx += 1;
  }

  const seekerIds: string[] = [];
  for (const s of SEEKERS) {
    const p = makeProfile(idx, s, 'user', null, pick(rand, REGIONS));
    profiles.push(p);
    accounts.push({ id: p.id, email: `worker${idx - EMPLOYERS.length}@haru.test`, password: 'haru1234' });
    seekerIds.push(p.id);
    idx += 1;
  }

  const admin = makeProfile(idx, '관리자', 'admin', 'HARU 운영팀', seoulGangseo);
  profiles.push(admin);
  accounts.push({ id: admin.id, email: 'admin@haru.test', password: 'haru1234' });

  /* ── 공고: 전국 모든 등록 지역에 분산 생성 ── */
  const jobPosts: JobPost[] = [];
  const categories = JOB_CATEGORY.filter((c) => JOB_TEMPLATES[c].length > 0) as JobCategory[];
  let jobSeq = 1;

  for (const region of REGIONS) {
    // 지역당 3~6건. 서울·경기는 물량이 많은 편이라 1~2건 더 얹는다.
    const bonus = region.sido === '서울특별시' || region.sido === '경기도' ? 2 : 0;
    const count = 3 + Math.floor(rand() * 4) + bonus;

    for (let i = 0; i < count; i += 1) {
      const category = pick(rand, categories);
      const tpl = pick(rand, JOB_TEMPLATES[category]);
      const employerIdx = Math.floor(rand() * EMPLOYERS.length);
      const employer = EMPLOYERS[employerIdx];

      // 지역 중심에서 약 ±0.022도(≈ 2.5km) 범위에 분포
      const lat = region.lat + (rand() - 0.5) * 0.044;
      const lng = region.lng + (rand() - 0.5) * 0.055;

      const dayOffset = Math.floor(rand() * 10) - 2; // -2 ~ +7일
      const workDate = toDateInput(addDays(now, dayOffset));
      const startHour = [6, 8, 9, 10, 11, 13, 18, 20][Math.floor(rand() * 8)];
      const duration = [4, 5, 6, 8][Math.floor(rand() * 4)];
      const payType = rand() > 0.45 ? 'hourly' : 'daily';
      const factor = payFactor(region);
      const payAmount =
        payType === 'hourly'
          ? roundPay((10_500 + rand() * 4_500) * factor, 100)
          : roundPay((80_000 + rand() * 70_000) * factor, 1_000);

      const createdOffset = Math.floor(rand() * 72);
      const createdAt = new Date(now.getTime() - createdOffset * 3_600_000).toISOString();

      jobPosts.push({
        id: `j${String(jobSeq).padStart(4, '0')}`,
        employerId: employerIds[employerIdx],
        title: tpl.title,
        companyName: `${region.name} ${employer.suffix}`,
        category,
        description: tpl.desc,
        workDate,
        startTime: `${String(startHour).padStart(2, '0')}:00`,
        endTime: `${String((startHour + duration) % 24).padStart(2, '0')}:00`,
        payType,
        payAmount,
        headcount: 1 + Math.floor(rand() * 6),
        placeName: `${region.name} ${pick(rand, PLACE_SUFFIX)}`,
        address: `${region.sido} ${region.name}`,
        lat,
        lng,
        requirements: tpl.req,
        belongings: tpl.belong,
        // 지난 날짜 공고는 마감 처리
        status: dayOffset < 0 ? 'closed' : 'open',
        createdAt,
        updatedAt: createdAt,
      });
      jobSeq += 1;
    }
  }

  /* ── 지원 ── */
  const applications: JobApplication[] = [];
  let appSeq = 1;
  for (const job of jobPosts) {
    const applicantCount = Math.floor(rand() * 4);
    const used = new Set<string>();
    for (let i = 0; i < applicantCount; i += 1) {
      const applicantId = pick(rand, seekerIds);
      if (used.has(applicantId) || applicantId === job.employerId) continue;
      used.add(applicantId);

      const isPast = new Date(`${job.workDate}T00:00:00`).getTime() < now.getTime();
      let status: JobApplication['status'];
      if (isPast) {
        status = rand() > 0.25 ? 'completed' : 'rejected';
      } else {
        const r = rand();
        status = r > 0.6 ? 'accepted' : r > 0.15 ? 'pending' : 'rejected';
      }

      applications.push({
        id: `a${String(appSeq).padStart(5, '0')}`,
        jobPostId: job.id,
        applicantId,
        message: rand() > 0.6 ? '성실히 하겠습니다. 시간 엄수 가능합니다.' : null,
        status,
        appliedAt: new Date(new Date(job.createdAt).getTime() + 3_600_000).toISOString(),
        completedAt: status === 'completed' ? `${job.workDate}T23:00:00.000Z` : null,
      });
      appSeq += 1;
    }
  }

  /* ── 리뷰 (근무 완료 건의 일부) ── */
  const reviews: Review[] = [];
  let revSeq = 1;
  for (const app of applications) {
    if (app.status !== 'completed') continue;
    if (rand() > 0.72) continue; // 일부는 "작성 가능한 리뷰"로 남겨둔다
    const job = jobPosts.find((j) => j.id === app.jobPostId)!;
    const base = 3 + Math.floor(rand() * 3); // 3~5
    const clamp = (n: number) => Math.max(1, Math.min(5, n));
    const ratingPay = clamp(base + (rand() > 0.8 ? -1 : 0));
    const ratingWorkload = clamp(base - (rand() > 0.6 ? 1 : 0));
    const ratingEnvironment = clamp(base + (rand() > 0.75 ? 1 : 0));
    const ratingAccuracy = clamp(base + (rand() > 0.85 ? -2 : 0));
    const overall = (ratingPay + ratingWorkload + ratingEnvironment + ratingAccuracy) / 4;

    reviews.push({
      id: `r${String(revSeq).padStart(5, '0')}`,
      applicationId: app.id,
      jobPostId: job.id,
      reviewerId: app.applicantId,
      employerId: job.employerId,
      ratingPay,
      ratingWorkload,
      ratingEnvironment,
      ratingAccuracy,
      wouldWorkAgain: overall >= 3.5,
      ratingOverall: Math.round(overall * 100) / 100,
      content: pick(rand, REVIEW_CONTENTS),
      isHidden: false,
      createdAt: new Date(new Date(app.completedAt!).getTime() + 7_200_000).toISOString(),
      updatedAt: new Date(new Date(app.completedAt!).getTime() + 7_200_000).toISOString(),
    });
    revSeq += 1;
  }

  /* ── 커뮤니티 ── */
  const posts: CommunityPost[] = COMMUNITY_SEED.map((p, i) => {
    const createdAt = new Date(now.getTime() - (i * 11 + 3) * 3_600_000).toISOString();
    return {
      id: `p${String(i + 1).padStart(3, '0')}`,
      authorId: pick(rand, seekerIds),
      category: p.category,
      title: p.title,
      content: p.content,
      viewCount: 20 + Math.floor(rand() * 300),
      likeCount: 0,
      commentCount: 0,
      isHidden: false,
      createdAt,
      updatedAt: createdAt,
    };
  });

  const comments: CommunityComment[] = [];
  let cSeq = 1;
  for (const post of posts) {
    const n = Math.floor(rand() * 4);
    for (let i = 0; i < n; i += 1) {
      comments.push({
        id: `c${String(cSeq).padStart(4, '0')}`,
        postId: post.id,
        authorId: pick(rand, [...seekerIds, ...employerIds]),
        content: pick(rand, COMMENT_SEED),
        isHidden: false,
        createdAt: new Date(new Date(post.createdAt).getTime() + (i + 1) * 1_800_000).toISOString(),
      });
      cSeq += 1;
    }
    post.commentCount = n;
  }

  const likes: SeedData['likes'] = [];
  let lSeq = 1;
  for (const post of posts) {
    const n = Math.floor(rand() * 6);
    const used = new Set<string>();
    for (let i = 0; i < n; i += 1) {
      const userId = pick(rand, seekerIds);
      if (used.has(userId)) continue;
      used.add(userId);
      likes.push({ id: `l${String(lSeq).padStart(4, '0')}`, postId: post.id, userId, createdAt: nowIso });
      lSeq += 1;
    }
    post.likeCount = used.size;
  }

  return { accounts, profiles, jobPosts, applications, reviews, posts, comments, likes, reports: [] };
}
