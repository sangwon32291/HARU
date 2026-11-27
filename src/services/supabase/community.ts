/** 커뮤니티 서비스 — Supabase 구현 */
import type { CommunityCategory } from '@/types/enums';
import type {
  CommunityCommentWithAuthor,
  CommunityPost,
  CommunityPostWithAuthor,
  CreatePostInput,
} from '@/types/database';
import { fail, ok, type Result, type ServiceErrorCode } from '../types';
import { supabase, mapPgError } from './client';
import { toComment, toCommentWithAuthor, toPost, toPostWithAuthor } from './mappers';

const POST_REL = '*, author:profiles!community_posts_author_id_fkey(id,nickname,avatar_url)';

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** 내가 좋아요한 게시글 id 집합 */
async function likedSet(postIds: string[]): Promise<Set<string>> {
  const me = await uid();
  if (!me || postIds.length === 0) return new Set();
  const { data } = await supabase
    .from('post_likes').select('post_id').eq('user_id', me).in('post_id', postIds);
  return new Set((data ?? []).map((r) => r.post_id));
}

export async function getCommunityPosts(params: {
  category?: CommunityCategory | null;
  keyword?: string | null;
  authorId?: string | null;
  limit?: number;
} = {}): Promise<Result<CommunityPostWithAuthor[]>> {
  let q = supabase.from('community_posts').select(POST_REL);
  if (params.category) q = q.eq('category', params.category);
  if (params.authorId) q = q.eq('author_id', params.authorId);
  const kw = params.keyword?.trim();
  if (kw) q = q.or(`title.ilike.%${kw}%,content.ilike.%${kw}%`);

  const { data, error } = await q
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 100);

  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  const rows = data ?? [];
  const liked = await likedSet(rows.map((r: any) => r.id));
  return ok(rows.map((r: any) => toPostWithAuthor(r, liked.has(r.id))));
}

export async function getCommunityPost(id: string): Promise<Result<CommunityPostWithAuthor>> {
  const { data, error } = await supabase.from('community_posts').select(POST_REL).eq('id', id).maybeSingle();
  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  if (!data) return fail('NOT_FOUND', '게시글을 찾을 수 없습니다.');

  // 조회수 증가 (실패해도 조회 자체는 성공으로 둔다)
  await supabase.from('community_posts')
    .update({ view_count: Number((data as any).view_count ?? 0) + 1 }).eq('id', id);

  const liked = await likedSet([id]);
  return ok(toPostWithAuthor({ ...data, view_count: Number((data as any).view_count ?? 0) + 1 },
    liked.has(id)));
}

function validate(i: Partial<CreatePostInput>): string | null {
  if (i.title !== undefined && (i.title.trim().length < 2 || i.title.trim().length > 60))
    return '제목은 2~60자로 입력해 주세요.';
  if (i.content !== undefined && i.content.trim().length < 5)
    return '내용을 5자 이상 입력해 주세요.';
  return null;
}

export async function createCommunityPost(input: CreatePostInput): Promise<Result<CommunityPost>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  const msg = validate(input);
  if (msg) return fail('VALIDATION_FAILED', msg);

  const { data, error } = await supabase.from('community_posts').insert({
    author_id: me, category: input.category,
    title: input.title.trim(), content: input.content.trim(),
  }).select('*').single();

  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok(toPost(data));
}

export async function updateCommunityPost(
  id: string, input: Partial<CreatePostInput>,
): Promise<Result<CommunityPost>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  const msg = validate(input);
  if (msg) return fail('VALIDATION_FAILED', msg);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.content !== undefined) patch.content = input.content.trim();
  if (input.category !== undefined) patch.category = input.category;

  const { data, error } = await supabase
    .from('community_posts').update(patch).eq('id', id).select('*').maybeSingle();
  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  if (!data) return fail('FORBIDDEN');
  return ok(toPost(data));
}

export async function deleteCommunityPost(id: string): Promise<Result<void>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  const { error } = await supabase.from('community_posts').delete().eq('id', id);
  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok(undefined);
}

export async function getComments(postId: string): Promise<Result<CommunityCommentWithAuthor[]>> {
  const { data, error } = await supabase
    .from('community_comments')
    .select('*, author:profiles!community_comments_author_id_fkey(id,nickname,avatar_url)')
    .eq('post_id', postId).order('created_at', { ascending: true });
  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok((data ?? []).map(toCommentWithAuthor));
}

export async function createComment(postId: string, content: string): Promise<Result<void>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  if (content.trim().length < 2) return fail('VALIDATION_FAILED', '댓글을 2자 이상 입력해 주세요.');

  const { error } = await supabase.from('community_comments')
    .insert({ post_id: postId, author_id: me, content: content.trim() });
  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok(undefined);
}

export async function deleteComment(id: string): Promise<Result<void>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');
  const { error } = await supabase.from('community_comments').delete().eq('id', id);
  if (error) {
    const m = mapPgError(error);
    return fail(m.code as ServiceErrorCode, m.message);
  }
  return ok(undefined);
}

export async function toggleLike(
  postId: string,
): Promise<Result<{ liked: boolean; likeCount: number }>> {
  const me = await uid();
  if (!me) return fail('UNAUTHENTICATED');

  const { data: existing } = await supabase
    .from('post_likes').select('id').eq('post_id', postId).eq('user_id', me).maybeSingle();

  if (existing) {
    const { error } = await supabase.from('post_likes').delete().eq('id', existing.id);
    if (error) {
      const m = mapPgError(error);
      return fail(m.code as ServiceErrorCode, m.message);
    }
  } else {
    const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: me });
    if (error) {
      const m = mapPgError(error);
      return fail(m.code as ServiceErrorCode, m.message);
    }
  }

  const { data: post } = await supabase
    .from('community_posts').select('like_count').eq('id', postId).maybeSingle();
  return ok({ liked: !existing, likeCount: Number(post?.like_count ?? 0) });
}

void toComment;
