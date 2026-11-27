import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createJob, getJobDetail, updateJob } from '@/services/jobs';
import type { CreateJobInput } from '@/types/database';
import { JOB_CATEGORY, JOB_CATEGORY_LABEL, PAY_TYPE_LABEL, type JobCategory, type PayType } from '@/types/enums';
import { useAuth } from '@/features/auth/AuthContext';
import { useLocationContext } from '@/features/location/LocationContext';
import { useToast } from '@/components/ui/toast';
import { HaruMap } from '@/components/map/HaruMap';
import { Button, Field, Input, Select, Spinner, Textarea } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppLayout';
import { addDays, cn, formatKRW, toDateInput, estimatedDailyPay } from '@/lib/format';
import { formatDistance, haversineM, type LatLng } from '@/lib/geo';

const EMPTY: CreateJobInput = {
  title: '',
  companyName: '',
  category: 'logistics',
  description: '',
  workDate: toDateInput(addDays(new Date(), 1)),
  startTime: '09:00',
  endTime: '18:00',
  payType: 'hourly',
  payAmount: 12000,
  headcount: 1,
  placeName: '',
  address: '',
  lat: 0,
  lng: 0,
  requirements: '',
  belongings: '',
};

export function JobFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { origin, label } = useLocationContext();
  const { toast } = useToast();

  const [form, setForm] = useState<CreateJobInput>(EMPTY);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !id) return;
    getJobDetail(id).then((res) => {
      if (res.data) {
        const j = res.data;
        if (user && j.employerId !== user.id) {
          toast('본인이 등록한 공고만 수정할 수 있습니다.', 'error');
          navigate(`/jobs/${id}`);
          return;
        }
        setForm({
          title: j.title,
          companyName: j.companyName,
          category: j.category,
          description: j.description,
          workDate: j.workDate,
          startTime: j.startTime,
          endTime: j.endTime,
          payType: j.payType,
          payAmount: j.payAmount,
          headcount: j.headcount,
          placeName: j.placeName,
          address: j.address ?? '',
          lat: j.lat,
          lng: j.lng,
          requirements: j.requirements ?? '',
          belongings: j.belongings ?? '',
        });
        setPoint({ lat: j.lat, lng: j.lng });
      }
      setLoading(false);
    });
  }, [id, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof CreateJobInput>(key: K, value: CreateJobInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!point) {
      setError('지도에서 근무 위치를 선택해 주세요.');
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      return;
    }
    setSubmitting(true);
    const payload: CreateJobInput = { ...form, lat: point.lat, lng: point.lng };
    const res = isEdit && id ? await updateJob(id, payload) : await createJob(payload);
    setSubmitting(false);

    if (res.error) {
      setError(res.error.message);
      return;
    }
    toast(isEdit ? '공고를 수정했습니다.' : '공고를 등록했습니다.', 'success');
    navigate(`/jobs/${res.data.id}`);
  };

  if (loading) return <Spinner label="공고 정보를 불러오는 중" />;

  const estimated = estimatedDailyPay(form.payType, form.payAmount, form.startTime, form.endTime);

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={isEdit ? '공고 수정' : '공고 등록'}
        description="구직자가 판단할 수 있도록 근무 조건을 구체적으로 적어주세요."
        backTo=""
      />

      <section className="haru-card space-y-4 p-4">
        <Field label="공고 제목" required hint="5~60자. 예: 택배 상하차 보조 (단기)" htmlFor="title">
          <Input
            id="title"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="어떤 일인지 한 줄로 적어주세요"
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="업체명" required htmlFor="companyName">
            <Input
              id="companyName"
              value={form.companyName}
              onChange={(e) => set('companyName', e.target.value)}
              placeholder="예: 마곡 제1물류센터"
              required
            />
          </Field>
          <Field label="직종" required htmlFor="category">
            <Select id="category" value={form.category} onChange={(e) => set('category', e.target.value as JobCategory)}>
              {JOB_CATEGORY.map((c) => (
                <option key={c} value={c}>
                  {JOB_CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="업무 내용" required hint="실제 하게 될 일을 구체적으로 적을수록 좋은 후기를 받습니다." htmlFor="description">
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="업무 흐름, 휴게 시간, 식사 제공 여부 등"
            required
          />
        </Field>
      </section>

      <section className="haru-card space-y-4 p-4">
        <h2 className="text-[17px] font-bold">근무 조건</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="근무일" required htmlFor="workDate">
            <Input id="workDate" type="date" value={form.workDate} onChange={(e) => set('workDate', e.target.value)} required />
          </Field>
          <Field label="시작 시각" required htmlFor="startTime">
            <Input id="startTime" type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} required />
          </Field>
          <Field label="종료 시각" required htmlFor="endTime">
            <Input id="endTime" type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} required />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="급여 유형" required htmlFor="payType">
            <Select id="payType" value={form.payType} onChange={(e) => set('payType', e.target.value as PayType)}>
              {(['hourly', 'daily'] as PayType[]).map((t) => (
                <option key={t} value={t}>
                  {PAY_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="금액 (원)"
            required
            hint={form.payType === 'hourly' ? `예상 일당 약 ${formatKRW(estimated)}` : undefined}
            htmlFor="payAmount"
          >
            <Input
              id="payAmount"
              type="number"
              inputMode="numeric"
              min={1}
              value={form.payAmount}
              onChange={(e) => set('payAmount', Number(e.target.value))}
              required
            />
          </Field>
          <Field label="모집 인원" required htmlFor="headcount">
            <Input
              id="headcount"
              type="number"
              inputMode="numeric"
              min={1}
              value={form.headcount}
              onChange={(e) => set('headcount', Number(e.target.value))}
              required
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="지원 자격" hint="선택 입력" htmlFor="requirements">
            <Input
              id="requirements"
              value={form.requirements ?? ''}
              onChange={(e) => set('requirements', e.target.value)}
              placeholder="예: 18세 이상"
            />
          </Field>
          <Field label="준비물" hint="선택 입력" htmlFor="belongings">
            <Input
              id="belongings"
              value={form.belongings ?? ''}
              onChange={(e) => set('belongings', e.target.value)}
              placeholder="예: 안전화, 장갑"
            />
          </Field>
        </div>
      </section>

      <section className="haru-card space-y-4 p-4">
        <div>
          <h2 className="text-[17px] font-bold">근무 위치</h2>
          <p className="mt-1 text-sm text-haru-sub">
            지도를 눌러 정확한 위치를 지정해 주세요. 이 좌표로 구직자와의 거리가 계산됩니다.
          </p>
        </div>

        <Field label="장소 이름" required htmlFor="placeName">
          <Input
            id="placeName"
            value={form.placeName}
            onChange={(e) => set('placeName', e.target.value)}
            placeholder="예: 마곡나루역 3번 출구 앞"
            required
          />
        </Field>
        <Field label="상세 주소" hint="선택 입력. 주소 검색은 제공하지 않으며 지도 좌표가 기준입니다." htmlFor="address">
          <Input
            id="address"
            value={form.address ?? ''}
            onChange={(e) => set('address', e.target.value)}
            placeholder="예: 서울 강서구 마곡동 000-0"
          />
        </Field>

        <HaruMap
          center={point ?? origin}
          zoom={15}
          pickMode
          pickedPoint={point}
          onPick={setPoint}
          showOrigin={false}
          className="h-72"
        />
        <p className={cn('text-sm', point ? 'text-haru-primary-dark' : 'text-haru-danger')}>
          {point
            ? `선택된 좌표: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)} · 현재 탐색 기준(${label})에서 ${formatDistance(
                haversineM(origin, point),
              )}`
            : '아직 위치가 지정되지 않았습니다. 지도를 눌러 주세요.'}
        </p>

        {/* 등록한 공고가 "주변 일자리"에서 안 보이는 혼란을 막기 위한 안내 */}
        {point && haversineM(origin, point) > 5000 && (
          <p className="rounded-xl border border-haru-warn/30 bg-[#FDF3E3]/60 px-4 py-3 text-sm leading-relaxed text-haru-warn">
            선택한 위치가 현재 탐색 기준에서 5km 넘게 떨어져 있습니다. 주변 일자리 목록은 기본 반경이 5km라
            이 공고가 바로 보이지 않을 수 있습니다. 목록에서 반경을 넓히거나 지역을 바꿔서 확인하세요.
          </p>
        )}
      </section>

      {error && (
        <p className="rounded-xl border border-haru-danger/30 bg-[#FCEBEB]/50 px-4 py-3 text-sm font-medium text-haru-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2 pb-6">
        <Button type="button" variant="outline" fullWidth onClick={() => navigate(-1)}>
          취소
        </Button>
        <Button type="submit" fullWidth size="lg" loading={submitting}>
          {isEdit ? '수정 완료' : '공고 등록'}
        </Button>
      </div>
    </form>
  );
}
