-- ============================================================================
-- HARU — 샘플 데이터 (seed)
--
-- 실행 순서: 001_schema.sql → 002_policies.sql → **seed.sql**
--
-- 생성되는 것
--   · 데모 계정 25개 (구인 12 / 구직 12 / 관리자 1)  비밀번호 공통: haru1234
--   · 전국 123개 시·군·구에 공고 약 600여 건
--   · 지원·근무완료 이력, 후기, 커뮤니티 글·댓글·좋아요
--
-- ⚠ 경고
--   이 스크립트는 비밀번호가 공개된 데모 계정을 만듭니다.
--   수업 시연·개발용으로만 쓰고, 실제 사용자를 받는 서비스에는 절대 실행하지 마십시오.
--   되돌리려면 맨 아래 "초기화" 블록의 주석을 풀고 실행하면 됩니다.
--
-- 여러 번 실행해도 중복되지 않습니다(기존 데모 데이터를 먼저 지웁니다).
-- ============================================================================

set search_path = public, extensions;

-- ── 기존 데모 데이터 정리 ───────────────────────────────────────────────────
-- @haru.test 계정이 만든 데이터만 지웁니다. 실제 가입자의 데이터는 건드리지 않습니다.
delete from auth.users where email like '%@haru.test';

do $$
declare
  -- ── 데모 계정 정의 ────────────────────────────────────────────────────────
  v_employers text[][] := array[
    array['한결인력','인력사무소'], array['대성물류','물류센터'],
    array['우리푸드','푸드서비스'], array['미소카페','카페'],
    array['튼튼건설','건설'],       array['행복마트','마트'],
    array['새벽이사','종합이사'],   array['이벤트웍스','이벤트'],
    array['청정클린','클린서비스'], array['바른사무','사무지원'],
    array['신속배송','배송'],       array['으뜸주방','주방']
  ];
  v_seekers text[] := array[
    '성실한하루','김알바','주말에만','야간러','손이빠른','체력왕',
    '초보지만','열정만렙','부지런한곰','하루하루','단기전문','꼼꼼한손'
  ];

  -- ── 공고 템플릿: 직종, 제목, 업무내용, 지원자격, 준비물 ───────────────────
  v_tpl text[][] := array[
    array['logistics','택배 상하차 보조 (단기)','컨베이어로 내려오는 택배 상자를 지역별로 분류하고 롤테이너에 적재하는 업무입니다. 2인 1조로 진행하며 중간 휴식 2회가 있습니다.','18세 이상 / 반복 동작 가능하신 분','편한 복장, 장갑(현장 지급 가능), 안전화 권장'],
    array['logistics','물류창고 피킹·포장','PDA로 상품 위치를 확인해 집품하고 박스 포장까지 담당합니다. 실내 근무이며 냉난방이 됩니다.','경력 무관 / 성실하신 분','신분증, 편한 운동화'],
    array['logistics','새벽 분류 작업 (단기)','새벽 시간대 물량 분류 작업입니다. 작업량에 따라 조기 종료될 수 있으며 종료 시각과 무관하게 약정 금액을 지급합니다.','새벽 출근 가능하신 분','편한 복장, 보온 의류(겨울)'],
    array['serving','점심 피크타임 홀서빙','11시 30분부터 14시까지 주문 받기, 음식 서빙, 테이블 정리를 담당합니다. 식사 제공됩니다.','친절한 응대 가능하신 분','검정 하의, 운동화'],
    array['serving','주말 저녁 홀 서빙','주말 저녁 손님이 몰리는 시간대 홀 업무입니다. 포스 사용은 알려드립니다.','주말 근무 가능하신 분','단정한 복장, 편한 신발'],
    array['kitchen','주방 보조 (설거지·재료 손질)','식자재 다듬기와 식기 세척을 담당합니다. 조리 경험이 없어도 알려드립니다.','위생 수칙 준수 가능하신 분','앞치마(지급), 편한 복장'],
    array['kitchen','단체급식 조리 보조','구내식당 배식 준비와 조리 보조, 정리 업무입니다. 식사 제공됩니다.','경력 무관','위생모(지급), 미끄럼 방지 신발'],
    array['cafe','주말 카페 홀·음료 보조','음료 제조 보조, 매장 정리, 간단한 베이커리 데우기 업무입니다. 바리스타 교육 가능합니다.','주말 양일 근무 가능하신 분 우대','흰 상의, 검정 하의'],
    array['cafe','베이커리 진열·포장','구워져 나온 빵을 진열하고 포장하는 업무입니다. 오전 시간대 근무입니다.','오전 출근 가능하신 분','편한 복장, 위생모(지급)'],
    array['delivery','지역 배송 보조 (동승)','배송 차량에 동승해 물품 하차와 전달을 돕습니다. 운전은 하지 않습니다.','무거운 물건 운반 가능하신 분','편한 복장, 장갑'],
    array['construction','현장 정리 및 자재 운반','공사 현장 폐자재 정리와 자재 운반 보조 업무입니다. 안전교육 후 투입됩니다.','안전 수칙 준수 / 19세 이상','안전화 필수, 작업복'],
    array['construction','건물 외벽 보수 보조','외벽 보수 작업의 자재 전달과 현장 정리를 담당합니다. 고소 작업은 하지 않습니다.','안전교육 이수 가능하신 분','안전화, 작업복, 장갑'],
    array['event','행사 안내 스태프','행사장 입구 안내, 명찰 배부, 동선 안내를 담당합니다. 단체복이 제공됩니다.','장시간 서서 근무 가능하신 분','검정 하의, 편한 신발'],
    array['event','축제 부스 설치·철거','행사 부스 설치와 철거, 물품 운반을 담당합니다. 2인 1조로 진행합니다.','경력 무관 / 체력 보통 이상','편한 복장, 장갑'],
    array['mart','마트 진열 및 재고 정리','입고 상품 진열, 유통기한 확인, 매대 정리 업무입니다.','경력 무관','편한 복장'],
    array['mart','주말 계산대 보조','계산대 포장 보조와 장바구니 정리를 담당합니다. 계산은 직원이 합니다.','주말 근무 가능하신 분','단정한 복장'],
    array['cleaning','사무실 입주 청소','신규 입주 사무실의 바닥, 창틀, 집기 청소를 진행합니다. 청소 도구는 전부 제공됩니다.','경력 무관 / 꼼꼼하신 분','편한 복장, 여벌 옷'],
    array['cleaning','행사 후 현장 정리','행사 종료 후 쓰레기 수거와 바닥 청소를 담당합니다.','경력 무관','편한 복장, 장갑'],
    array['office','서류 스캔·정리 사무보조','문서 스캔, 파일 정리, 간단한 엑셀 입력을 담당합니다. 실내 좌식 업무입니다.','기본적인 컴퓨터 사용 가능하신 분','단정한 복장'],
    array['office','설문 자료 입력','수기 설문지를 엑셀 양식에 입력하는 업무입니다. 타자 속도가 빠르면 좋습니다.','엑셀 기본 사용 가능하신 분','신분증'],
    array['etc','전단 배포 및 홍보 보조','지정 구역에서 전단을 배포하고 간단한 안내를 합니다.','경력 무관','편한 신발'],
    array['etc','창고 재고 조사 보조','창고 물품 수량을 확인하고 기록지에 기입하는 업무입니다.','숫자 확인이 꼼꼼하신 분','편한 복장, 필기구']
  ];

  v_place text[] := array[
    '중앙시장 입구','시외버스터미널 앞','우체국 사거리','종합운동장 주차장',
    '하나로마트 앞','보건소 맞은편','문화회관 앞','도서관 버스정류장',
    '산업단지 정문','물류센터 하차장','행정복지센터 앞','공영주차장 입구',
    '역 1번 출구 앞','사거리 농협 앞'
  ];

  v_review text[] := array[
    '공고에 적힌 내용과 실제 업무가 거의 같았습니다. 담당자분이 처음에 동선을 설명해주셔서 헤매지 않았습니다. 급여도 다음 날 바로 입금됐습니다.',
    '업무 강도는 조금 있는 편이지만 쉬는 시간을 제대로 챙겨주셨습니다. 다시 부르시면 또 갈 생각입니다.',
    '생각보다 사람이 적게 와서 일이 몰렸습니다. 급여는 정확히 지급됐지만 인원 관리는 아쉬웠습니다.',
    '실내라 날씨 영향이 없어서 좋았고, 식사도 제공해주셨습니다. 초보자도 할 만합니다.',
    '전반적으로 무난했습니다. 다만 집합 장소 안내가 조금 헷갈려서 10분 정도 헤맸습니다.',
    '현장 분위기가 좋았습니다. 중간에 음료도 나눠주셔서 끝까지 할 만했습니다.',
    '처음이라 걱정했는데 옆에서 계속 알려주셔서 금방 적응했습니다. 추천합니다.',
    '일 자체는 단순한데 반복이 많아 지루할 수 있습니다. 급여 지급은 깔끔했습니다.'
  ];

  v_employer_ids uuid[] := '{}';
  v_seeker_ids   uuid[] := '{}';
  v_admin_id     uuid;
  v_uid          uuid;
  v_region       record;
  v_job_id       uuid;
  v_app_id       uuid;
  v_i int; v_n int; v_t int; v_e int; v_k int; v_app_n int;
  v_pay_factor numeric;
  v_pay_type text; v_pay int;
  v_start int; v_dur int; v_offset int; v_work date;
  v_status text; v_app_status text;
  v_rp int; v_rw int; v_re int; v_ra int;
  v_used uuid[];
  v_seeker uuid;
begin
  -- 결정적 난수: 몇 번을 실행해도 같은 데이터가 나옵니다.
  perform setseed(0.20261106);

  -- ── 계정 생성 ─────────────────────────────────────────────────────────────
  -- auth.users 에 직접 넣고, 프로필은 001 의 handle_new_user 트리거가 만듭니다.
  for v_i in 1 .. array_length(v_employers, 1) loop
    v_uid := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'employer' || v_i || '@haru.test', crypt('haru1234', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nickname', v_employers[v_i][1]),
      now(), now()
    );
    v_employer_ids := v_employer_ids || v_uid;
  end loop;

  for v_i in 1 .. array_length(v_seekers, 1) loop
    v_uid := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'worker' || v_i || '@haru.test', crypt('haru1234', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nickname', v_seekers[v_i]),
      now(), now()
    );
    v_seeker_ids := v_seeker_ids || v_uid;
  end loop;

  v_admin_id := gen_random_uuid();
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'admin@haru.test', crypt('haru1234', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nickname":"관리자"}'::jsonb, now(), now()
  );
  -- 관리자 지정.
  -- 001 의 prevent_role_escalation 트리거가 role 변경을 막으므로(= 정상 동작)
  -- seed 에서만 잠시 꺼고 지정한 뒤 즉시 되돌립니다.
  execute 'alter table public.profiles disable trigger trg_prevent_role_escalation';
  update public.profiles set role = 'admin', bio = 'HARU 운영팀' where id = v_admin_id;
  execute 'alter table public.profiles enable trigger trg_prevent_role_escalation';

  -- ── 인증 서버(GoTrue) 호환 처리 ───────────────────────────────────────────
  -- auth.users 에 직접 INSERT 하면 GoTrue 가 읽는 토큰 컬럼이 NULL 로 남아
  -- 로그인 시 "Database error querying schema" 500 오류가 납니다.
  -- 빈 문자열로 채워야 정상 로그인됩니다.
  update auth.users
     set confirmation_token         = coalesce(confirmation_token, ''),
         recovery_token             = coalesce(recovery_token, ''),
         email_change               = coalesce(email_change, ''),
         email_change_token_new     = coalesce(email_change_token_new, ''),
         email_change_token_current = coalesce(email_change_token_current, ''),
         phone_change               = coalesce(phone_change, ''),
         phone_change_token         = coalesce(phone_change_token, ''),
         reauthentication_token     = coalesce(reauthentication_token, ''),
         email_confirmed_at         = coalesce(email_confirmed_at, now())
   where email like '%@haru.test';

  -- ── 전국 지역 목록 ────────────────────────────────────────────────────────
  create temporary table tmp_regions (
    code text, sido text, name text, lat double precision, lng double precision
  ) on commit drop;

  insert into tmp_regions (code, sido, name, lat, lng) values
    ('11110', '서울특별시', '종로구', 37.573, 126.979),
    ('11140', '서울특별시', '중구', 37.564, 126.998),
    ('11170', '서울특별시', '용산구', 37.532, 126.99),
    ('11200', '서울특별시', '성동구', 37.563, 127.037),
    ('11215', '서울특별시', '광진구', 37.538, 127.082),
    ('11230', '서울특별시', '동대문구', 37.574, 127.04),
    ('11260', '서울특별시', '중랑구', 37.606, 127.093),
    ('11290', '서울특별시', '성북구', 37.589, 127.017),
    ('11305', '서울특별시', '강북구', 37.64, 127.026),
    ('11320', '서울특별시', '도봉구', 37.669, 127.047),
    ('11350', '서울특별시', '노원구', 37.654, 127.056),
    ('11380', '서울특별시', '은평구', 37.603, 126.929),
    ('11410', '서울특별시', '서대문구', 37.579, 126.937),
    ('11440', '서울특별시', '마포구', 37.566, 126.902),
    ('11470', '서울특별시', '양천구', 37.517, 126.867),
    ('11500', '서울특별시', '강서구', 37.551, 126.85),
    ('11530', '서울특별시', '구로구', 37.495, 126.887),
    ('11545', '서울특별시', '금천구', 37.457, 126.896),
    ('11560', '서울특별시', '영등포구', 37.526, 126.896),
    ('11590', '서울특별시', '동작구', 37.512, 126.939),
    ('11620', '서울특별시', '관악구', 37.478, 126.952),
    ('11650', '서울특별시', '서초구', 37.484, 127.033),
    ('11680', '서울특별시', '강남구', 37.517, 127.047),
    ('11710', '서울특별시', '송파구', 37.515, 127.106),
    ('11740', '서울특별시', '강동구', 37.53, 127.124),
    ('41110', '경기도', '수원시', 37.263, 127.029),
    ('41130', '경기도', '성남시', 37.42, 127.127),
    ('41150', '경기도', '의정부시', 37.738, 127.034),
    ('41170', '경기도', '안양시', 37.394, 126.957),
    ('41190', '경기도', '부천시', 37.504, 126.766),
    ('41210', '경기도', '광명시', 37.479, 126.865),
    ('41220', '경기도', '평택시', 36.992, 127.113),
    ('41250', '경기도', '동두천시', 37.903, 127.06),
    ('41270', '경기도', '안산시', 37.322, 126.831),
    ('41280', '경기도', '고양시', 37.658, 126.832),
    ('41290', '경기도', '과천시', 37.429, 126.988),
    ('41310', '경기도', '구리시', 37.594, 127.13),
    ('41360', '경기도', '남양주시', 37.636, 127.216),
    ('41370', '경기도', '오산시', 37.15, 127.077),
    ('41390', '경기도', '시흥시', 37.38, 126.803),
    ('41410', '경기도', '군포시', 37.361, 126.935),
    ('41430', '경기도', '의왕시', 37.345, 126.968),
    ('41450', '경기도', '하남시', 37.539, 127.215),
    ('41460', '경기도', '용인시', 37.241, 127.178),
    ('41480', '경기도', '파주시', 37.76, 126.78),
    ('41500', '경기도', '이천시', 37.272, 127.435),
    ('41550', '경기도', '안성시', 37.008, 127.27),
    ('41570', '경기도', '김포시', 37.615, 126.716),
    ('41590', '경기도', '화성시', 37.199, 126.831),
    ('41610', '경기도', '광주시', 37.429, 127.255),
    ('41630', '경기도', '양주시', 37.785, 127.046),
    ('41650', '경기도', '포천시', 37.895, 127.2),
    ('41670', '경기도', '여주시', 37.298, 127.637),
    ('28110', '인천광역시', '중구', 37.474, 126.622),
    ('28140', '인천광역시', '동구', 37.474, 126.643),
    ('28177', '인천광역시', '미추홀구', 37.464, 126.65),
    ('28185', '인천광역시', '연수구', 37.41, 126.678),
    ('28200', '인천광역시', '남동구', 37.447, 126.731),
    ('28237', '인천광역시', '부평구', 37.507, 126.721),
    ('28245', '인천광역시', '계양구', 37.537, 126.738),
    ('28260', '인천광역시', '서구', 37.545, 126.676),
    ('26110', '부산광역시', '중구', 35.106, 129.032),
    ('26230', '부산광역시', '부산진구', 35.163, 129.053),
    ('26260', '부산광역시', '동래구', 35.205, 129.084),
    ('26290', '부산광역시', '남구', 35.137, 129.084),
    ('26380', '부산광역시', '사하구', 35.105, 128.975),
    ('26410', '부산광역시', '금정구', 35.243, 129.092),
    ('26440', '부산광역시', '강서구', 35.212, 128.98),
    ('26470', '부산광역시', '연제구', 35.176, 129.079),
    ('26500', '부산광역시', '사상구', 35.153, 128.991),
    ('26350', '부산광역시', '해운대구', 35.163, 129.164),
    ('27110', '대구광역시', '중구', 35.869, 128.606),
    ('27140', '대구광역시', '동구', 35.887, 128.636),
    ('27200', '대구광역시', '남구', 35.846, 128.598),
    ('27230', '대구광역시', '북구', 35.886, 128.583),
    ('27260', '대구광역시', '수성구', 35.858, 128.631),
    ('27290', '대구광역시', '달서구', 35.83, 128.533),
    ('29110', '광주광역시', '동구', 35.146, 126.923),
    ('29140', '광주광역시', '서구', 35.152, 126.89),
    ('29155', '광주광역시', '남구', 35.133, 126.902),
    ('29170', '광주광역시', '북구', 35.174, 126.912),
    ('29200', '광주광역시', '광산구', 35.14, 126.794),
    ('30110', '대전광역시', '동구', 36.312, 127.455),
    ('30140', '대전광역시', '중구', 36.325, 127.421),
    ('30170', '대전광역시', '서구', 36.355, 127.384),
    ('30200', '대전광역시', '유성구', 36.362, 127.356),
    ('30230', '대전광역시', '대덕구', 36.347, 127.415),
    ('31110', '울산광역시', '중구', 35.57, 129.332),
    ('31140', '울산광역시', '남구', 35.544, 129.33),
    ('31170', '울산광역시', '동구', 35.505, 129.417),
    ('31200', '울산광역시', '북구', 35.583, 129.361),
    ('31710', '울산광역시', '울주군', 35.522, 129.242),
    ('36110', '세종특별자치시', '세종시', 36.48, 127.289),
    ('51110', '강원특별자치도', '춘천시', 37.881, 127.73),
    ('51130', '강원특별자치도', '원주시', 37.342, 127.92),
    ('51150', '강원특별자치도', '강릉시', 37.752, 128.876),
    ('51210', '강원특별자치도', '속초시', 38.207, 128.591),
    ('43110', '충청북도', '청주시', 36.642, 127.489),
    ('43130', '충청북도', '충주시', 36.991, 127.926),
    ('43150', '충청북도', '제천시', 37.133, 128.191),
    ('44130', '충청남도', '천안시', 36.815, 127.114),
    ('44200', '충청남도', '아산시', 36.79, 127.002),
    ('44150', '충청남도', '공주시', 36.447, 127.119),
    ('44210', '충청남도', '서산시', 36.785, 126.45),
    ('44270', '충청남도', '당진시', 36.89, 126.646),
    ('52110', '전북특별자치도', '전주시', 35.824, 127.148),
    ('52130', '전북특별자치도', '군산시', 35.968, 126.737),
    ('52140', '전북특별자치도', '익산시', 35.948, 126.958),
    ('46110', '전라남도', '목포시', 34.812, 126.392),
    ('46130', '전라남도', '여수시', 34.76, 127.662),
    ('46150', '전라남도', '순천시', 34.95, 127.487),
    ('46230', '전라남도', '광양시', 34.941, 127.696),
    ('47110', '경상북도', '포항시', 36.019, 129.343),
    ('47130', '경상북도', '경주시', 35.856, 129.225),
    ('47190', '경상북도', '구미시', 36.12, 128.344),
    ('47170', '경상북도', '안동시', 36.568, 128.73),
    ('48120', '경상남도', '창원시', 35.228, 128.682),
    ('48170', '경상남도', '진주시', 35.18, 128.108),
    ('48250', '경상남도', '김해시', 35.229, 128.89),
    ('48330', '경상남도', '양산시', 35.335, 129.037),
    ('48310', '경상남도', '거제시', 34.88, 128.621),
    ('50110', '제주특별자치도', '제주시', 33.499, 126.531),
    ('50130', '제주특별자치도', '서귀포시', 33.254, 126.56);

  -- ── 공고 생성: 지역마다 3~8건 ─────────────────────────────────────────────
  for v_region in select * from tmp_regions loop
    v_pay_factor := case
      when v_region.sido = '서울특별시' then 1.06
      when v_region.sido in ('경기도','인천광역시') then 1.02
      when v_region.sido like '%광역시' or v_region.sido = '세종특별자치시' then 1.00
      else 0.95
    end;

    -- 서울·경기는 물량이 많은 편이라 2건 더 얹습니다.
    v_n := 3 + floor(random() * 4)::int
           + case when v_region.sido in ('서울특별시','경기도') then 2 else 0 end;

    for v_i in 1 .. v_n loop
      v_t := 1 + floor(random() * array_length(v_tpl, 1))::int;
      v_e := 1 + floor(random() * array_length(v_employer_ids, 1))::int;

      v_offset := floor(random() * 10)::int - 2;      -- -2 ~ +7일
      v_work   := current_date + v_offset;
      v_status := case when v_offset < 0 then 'closed' else 'open' end;

      v_start := (array[6,8,9,10,11,13,18,20])[1 + floor(random() * 8)::int];
      v_dur   := (array[4,5,6,8])[1 + floor(random() * 4)::int];

      v_pay_type := case when random() > 0.45 then 'hourly' else 'daily' end;
      v_pay := case v_pay_type
                 when 'hourly' then round((10500 + random() * 4500) * v_pay_factor / 100) * 100
                 else               round((80000 + random() * 70000) * v_pay_factor / 1000) * 1000
               end;

      insert into public.job_posts (
        employer_id, title, company_name, category, description,
        work_date, start_time, end_time, pay_type, pay_amount, headcount,
        place_name, address, lat, lng, requirements, belongings, status, created_at
      ) values (
        v_employer_ids[v_e],
        v_tpl[v_t][2],
        v_region.name || ' ' || v_employers[v_e][2],
        v_tpl[v_t][1],
        v_tpl[v_t][3],
        v_work,
        make_time(v_start, 0, 0),
        make_time((v_start + v_dur) % 24, 0, 0),
        v_pay_type, v_pay,
        1 + floor(random() * 6)::int,
        v_region.name || ' ' || v_place[1 + floor(random() * array_length(v_place,1))::int],
        v_region.sido || ' ' || v_region.name,
        -- 지역 중심에서 약 ±2.5km 범위에 분포
        v_region.lat + (random() - 0.5) * 0.044,
        v_region.lng + (random() - 0.5) * 0.055,
        v_tpl[v_t][4], v_tpl[v_t][5],
        v_status,
        now() - (floor(random() * 72) || ' hours')::interval
      ) returning id into v_job_id;

      -- ── 지원 0~3건 ────────────────────────────────────────────────────────
      -- 주의: 바깥 루프의 v_e(구인자 인덱스)를 덮어쓰지 않도록 v_k 를 씁니다.
      v_used := '{}';
      v_app_n := floor(random() * 4)::int;
      for v_k in 1 .. v_app_n loop
        v_seeker := v_seeker_ids[1 + floor(random() * array_length(v_seeker_ids,1))::int];
        continue when v_seeker = any(v_used);
        v_used := v_used || v_seeker;

        if v_work < current_date then
          v_app_status := case when random() > 0.25 then 'completed' else 'rejected' end;
        else
          v_app_status := case
            when random() > 0.60 then 'accepted'
            when random() > 0.15 then 'pending'
            else 'rejected' end;
        end if;

        -- 상태 전이 트리거를 피하려고 최종 상태로 바로 INSERT 합니다.
        insert into public.job_applications (
          job_post_id, applicant_id, message, status, applied_at, completed_at
        ) values (
          v_job_id, v_seeker,
          case when random() > 0.6 then '성실히 하겠습니다. 시간 엄수 가능합니다.' else null end,
          v_app_status,
          now() - (floor(random() * 48) || ' hours')::interval,
          case when v_app_status = 'completed' then v_work + time '23:00' else null end
        ) returning id into v_app_id;

        -- ── 후기: 근무 완료 건의 약 70% ────────────────────────────────────
        if v_app_status = 'completed' and random() < 0.70 then
          v_rp := 3 + floor(random() * 3)::int;
          v_rw := greatest(1, v_rp - (case when random() > 0.6 then 1 else 0 end));
          v_re := least(5, v_rp + (case when random() > 0.75 then 1 else 0 end));
          v_ra := greatest(1, v_rp - (case when random() > 0.85 then 2 else 0 end));

          insert into public.reviews (
            application_id, job_post_id, reviewer_id, employer_id,
            rating_pay, rating_workload, rating_environment, rating_accuracy,
            would_work_again, content, created_at
          ) values (
            v_app_id, v_job_id, v_seeker, v_employer_ids[v_e],
            v_rp, v_rw, v_re, v_ra,
            ((v_rp + v_rw + v_re + v_ra)::numeric / 4) >= 3.5,
            v_review[1 + floor(random() * array_length(v_review,1))::int],
            v_work + time '23:30'
          );
        end if;
      end loop;
    end loop;
  end loop;

  -- 평점 집계 재계산 (트리거가 건건이 갱신하지만, 마지막에 한 번 맞춰둡니다)
  update public.profiles p
     set rating_avg = coalesce((
           select round(avg(x.rating_overall), 2) from public.reviews x
            where x.employer_id = p.id and x.is_hidden = false), 0),
         review_count = (
           select count(*) from public.reviews x
            where x.employer_id = p.id and x.is_hidden = false);

  -- ── 커뮤니티 ──────────────────────────────────────────────────────────────
  insert into public.community_posts (author_id, category, title, content, view_count, created_at)
  select
    v_seeker_ids[1 + floor(random() * array_length(v_seeker_ids,1))::int],
    c.category, c.title, c.content,
    20 + floor(random() * 300)::int,
    now() - ((c.ord * 11 + 3) || ' hours')::interval
  from (values
    (1,'caution','공고에 적힌 시간보다 2시간 더 시킨 곳 후기',
     E'어제 다녀온 현장 공유합니다. 공고에는 6시간이라고 적혀 있었는데 실제로는 8시간 가까이 진행됐습니다. 추가 시간분은 결국 정산받았지만, 미리 물어보지 않으면 그냥 넘어갈 뻔했습니다.\n\n현장 도착하면 담당자에게 종료 시간을 먼저 확인하고, 연장될 경우 어떻게 계산되는지 문자로 남겨두는 걸 추천합니다.'),
    (2,'info','일용직 처음 하는 분들을 위한 체크리스트',
     E'몇 달 하면서 정리한 내용입니다.\n\n1. 신분증은 무조건 챙기기 (없으면 돌려보내는 곳 있습니다)\n2. 식사 제공 여부 미리 확인\n3. 급여 지급일 꼭 확인 — 당일 지급인지 익일인지\n4. 현장 주소와 실제 집합 장소가 다른 경우가 있으니 전날 연락 한 번\n5. 장갑은 본인 것 챙기면 편합니다'),
    (3,'review','물류센터 단기 3일 다녀온 후기',
     E'생각보다 할 만했습니다. 2인 1조라 혼자 무거운 걸 드는 일은 거의 없었고, 2시간마다 쉬는 시간이 있었습니다. 다만 첫날은 손목이 좀 아팠습니다.\n\n급여는 공고대로 다음 날 입금됐습니다. 담당자분도 설명을 자세히 해주셔서 처음 하는 분도 괜찮을 것 같습니다.'),
    (4,'free','다들 하루 일당 받으면 어디에 쓰시나요',
     '오늘 일당 받았는데 괜히 기분이 좋네요. 다들 어떻게 관리하시는지 궁금합니다.'),
    (5,'info','단기 알바 공고 많이 올라오는 요일',
     '체감상 목요일 저녁~금요일 오전에 주말 건이 제일 많이 올라옵니다. 물류 쪽은 월초에 몰리는 편이고, 행사 스태프는 주말 직전에 급하게 올라오는 경우가 많습니다.'),
    (6,'caution','면접 보러 오라면서 교통비도 안 주는 곳',
     '단기 알바인데 사전 면접을 요구하는 곳이 있었습니다. 왕복 1시간 거리였는데 결국 채용도 안 됐습니다. 단기 건은 전화 면접으로 충분한 경우가 대부분이라고 생각합니다.'),
    (7,'info','지방에서 단기 알바 구할 때 팁',
     '수도권보다 공고 수가 적은 대신 경쟁도 덜합니다. 산업단지나 물류센터가 있는 지역은 꾸준히 물량이 나오니 반경을 10~20km로 넓혀서 보시는 걸 추천합니다.'),
    (8,'review','행사 스태프 처음 해봤는데 생각보다 괜찮았어요',
     '하루 8시간 서 있는 게 힘들긴 했지만 분위기가 좋았습니다. 단체복도 주고 식사도 제공해줘서 만족합니다. 다만 신발은 꼭 편한 걸로 신으세요.')
  ) as c(ord, category, title, content);

  -- 댓글: 글마다 0~3개
  insert into public.community_comments (post_id, author_id, content, created_at)
  select p.id,
         (v_seeker_ids || v_employer_ids)[1 + floor(random() * (array_length(v_seeker_ids,1) + array_length(v_employer_ids,1)))::int],
         (array[
           '좋은 정보 감사합니다. 저도 다음 주에 비슷한 현장 갑니다.',
           '저도 같은 경험 있습니다. 미리 확인하는 게 정말 중요하더라고요.',
           '혹시 그 현장 담당자분 성함 아시나요? 비슷한 공고 보고 있어서요.',
           '정리 깔끔하네요. 처음 하는 분들께 도움 될 것 같습니다.',
           '공감합니다. 저는 그래서 문자로 꼭 남겨둡니다.',
           '지방도 요즘 공고 꽤 올라오더라고요. 참고하겠습니다.'
         ])[1 + floor(random() * 6)::int],
         p.created_at + ((g.n * 30) || ' minutes')::interval
    from public.community_posts p
   cross join generate_series(1, 3) as g(n)
   where random() < 0.6;

  -- 좋아요
  insert into public.post_likes (post_id, user_id)
  select p.id, s.uid
    from public.community_posts p
   cross join unnest(v_seeker_ids) as s(uid)
   where random() < 0.4
  on conflict (post_id, user_id) do nothing;

end $$;


-- ============================================================================
-- 결과 확인
-- ============================================================================
select '계정'   as 항목, count(*) as 건수 from public.profiles
union all select '공고(전체)',   count(*) from public.job_posts
union all select '공고(모집중)', count(*) from public.job_posts where status = 'open'
union all select '지원',         count(*) from public.job_applications
union all select '근무완료',     count(*) from public.job_applications where status = 'completed'
union all select '후기',         count(*) from public.reviews
union all select '게시글',       count(*) from public.community_posts
union all select '댓글',         count(*) from public.community_comments;

-- 지역별 공고 수 상위 10곳
select address, count(*) as 공고수
  from public.job_posts
 where status = 'open'
 group by address
 order by 공고수 desc
 limit 10;


-- ============================================================================
-- 초기화 (되돌리고 싶을 때만 아래 한 줄의 주석을 풀고 실행)
--   데모 계정과 그 계정이 만든 모든 데이터가 CASCADE 로 함께 삭제됩니다.
-- ----------------------------------------------------------------------------
-- delete from auth.users where email like '%@haru.test';
-- ============================================================================
