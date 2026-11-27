import { PAY_TYPE_LABEL, type PayType } from '@/types/enums';

export function formatKRW(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function formatPay(payType: PayType, amount: number): string {
  return `${PAY_TYPE_LABEL[payType]} ${formatKRW(amount)}`;
}

/**
 * 지도 마커용 짧은 금액 표기.
 * 마커가 서로 겹치지 않도록 "시급 13,000원" 대신 "1.3만"으로 줄인다.
 */
export function formatPayShort(amount: number): string {
  if (amount < 10_000) return `${Math.round(amount / 1000)}천`;
  const man = amount / 10_000;
  return man >= 10 ? `${Math.round(man)}만` : `${man.toFixed(1).replace(/\.0$/, '')}만`;
}

/** 'YYYY-MM-DD' → '10월 18일 (토)' / 오늘·내일은 라벨로 */
export function formatWorkDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const today = startOfToday();
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === 2) return '모레';
  const week = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${week})`;
}

export function formatWorkTime(start: string, end: string): string {
  return `${start} ~ ${end}`;
}

/** 근무 시간(시간 단위). 자정을 넘기는 경우 +24h 처리 */
export function workHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes / 60;
}

/** 시급/일급을 '예상 일당'으로 환산 (안내용 추정치) */
export function estimatedDailyPay(payType: PayType, amount: number, start: string, end: string): number {
  if (payType === 'daily') return amount;
  return Math.round(amount * workHours(start, end));
}

export function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  const d = new Date(t);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function formatRating(value: number): string {
  return value > 0 ? value.toFixed(1) : '-';
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** 카드 메타 줄에서 쓰는 짧은 날짜. 예: '11/16(월)' */
export function formatWorkDateShort(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const week = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${week})`;
}

/**
 * 오늘·내일 공고에만 붙이는 긴급 라벨.
 * 배지 줄이 줄바꿈되지 않도록 짧은 문구만 돌려주고, 그 외에는 null 이다.
 */
export function urgencyLabel(dateStr: string): '오늘' | '내일' | null {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.round((d.getTime() - startOfToday().getTime()) / 86_400_000);
  return diff === 0 ? '오늘' : diff === 1 ? '내일' : null;
}
