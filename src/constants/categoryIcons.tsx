/**
 * 직종별 아이콘.
 *
 * 이모지 대신 lucide 아이콘을 쓰는 이유: 이모지는 운영체제마다 모양·색이 달라
 * 같은 화면이 기기별로 다르게 보이고, 브랜드 색(#2E8B57)과 톤이 맞지 않는다.
 * lucide 아이콘은 선 굵기와 색을 코드로 통제할 수 있어 전체가 한 세트로 보인다.
 */
import {
  Bike,
  ChefHat,
  Coffee,
  FileText,
  HardHat,
  MoreHorizontal,
  Package,
  PartyPopper,
  ShoppingCart,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import type { JobCategory } from '@/types/enums';

export const JOB_CATEGORY_ICON: Record<JobCategory, LucideIcon> = {
  serving: UtensilsCrossed,
  kitchen: ChefHat,
  cafe: Coffee,
  delivery: Bike,
  logistics: Package,
  construction: HardHat,
  event: PartyPopper,
  mart: ShoppingCart,
  cleaning: Sparkles,
  office: FileText,
  etc: MoreHorizontal,
};

/** 배지·버튼 안에서 쓰는 작은 아이콘 */
export function CategoryIcon({
  category,
  className = 'h-3.5 w-3.5',
}: {
  category: JobCategory;
  className?: string;
}) {
  const Icon = JOB_CATEGORY_ICON[category];
  return <Icon className={className} aria-hidden />;
}
