/** 커뮤니티 서비스 (COM-01 ~ COM-06) */
import type { CommunityCategory } from '@/types/enums';
import type {
  CommunityCommentWithAuthor,
  CommunityPost,
  CommunityPostWithAuthor,
  CreatePostInput,
} from '@/types/database';
import {
  commit,
  currentUser,
  findProfile,
  getState,
  isAdmin,
  nextId,
  nowIso,
  recomputePostCounters,
} from './db';
import { delay, fail, ok, type Result } from '../types';

function withAuthor(post: CommunityPost): CommunityPostWithAuthor {
  const author = findProfile(post.authorId);
  const me = currentUser();
  return {
    ...post,
    author: {
      id: post.authorId,
      nickname: author?.nickname ?? '알 수 없음',
      avatarUrl: author?.avatarUrl ?? null,
    },
    likedByMe: me ? getState().likes.some((l) => l.postId === post.id && l.userId === me.id) : false,
  };
}

function postVisible(post: CommunityPost): boolean {
  if (!post.isHidden) return true;
  return isAdmin() || currentUser()?.id === post.authorId;
}

export async function getCommunityPosts(params: {
  category?: CommunityCategory | null;
  keyword?: string | null;
  authorId?: string | null;
  limit?: number;
} = {}): Promise<Result<CommunityPostWithAuthor[]>> {
  await delay(120);
  const kw = params.keyword?.trim().toLowerCase();
  const rows = getState()
    .posts.filter(postVisible)
    .filter((p) => (params.category ? p.category === params.category : true))
    .filter((p) => (params.authorId ? p.authorId === params.authorId : true))
    .filter((p) =>
      kw ? p.title.toLowerCase().includes(kw) || p.content.toLowerCase().includes(kw) : true,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, params.limit ?? 100)
    .map(withAuthor);
  return ok(rows);
}

export async function getCommunityPost(id: string): Promise<Result<CommunityPostWithAuthor>> {
  await delay(100);
  const post = getState().posts.find((p) => p.id === id);
  if (!post || !postVisible(post)) return fail('NOT_FOUND', '게시글을 찾을 수 없습니다.');
  post.viewCount += 1;
  commit();
  return ok(withAuthor(post));
}

function validatePost(input: Partial<CreatePostInput>): string | null {
  if (input.title !== undefined && (input.title.trim().length < 2 || input.title.trim().length > 60)) {
    return '제목은 2~60자로 입력해 주세요.';
  }
  if (input.content !== undefined && input.content.trim().length < 5) {
    return '내용을 5자 이상 입력해 주세요.';
  }
  return null;
}

export async function createCommunityPost(input: CreatePostInput): Promise<Result<CommunityPost>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const message = validatePost(input);
  if (message) return fail('VALIDATION_FAILED', message);

  const now = nowIso();
  const post: CommunityPost = {
    id: nextId('p'),
    authorId: me.id,
    category: input.category,
    title: input.title.trim(),
    content: input.content.trim(),
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    isHidden: false,
    createdAt: now,
    updatedAt: now,
  };
  getState().posts.unshift(post);
  commit();
  return ok(post);
}

export async function updateCommunityPost(
  id: string,
  input: Partial<CreatePostInput>,
): Promise<Result<CommunityPost>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const post = getState().posts.find((p) => p.id === id);
  if (!post) return fail('NOT_FOUND');
  if (post.authorId !== me.id && !isAdmin()) return fail('FORBIDDEN');
  const message = validatePost(input);
  if (message) return fail('VALIDATION_FAILED', message);

  Object.assign(post, {
    ...input,
    title: input.title?.trim() ?? post.title,
    content: input.content?.trim() ?? post.content,
    updatedAt: nowIso(),
  });
  commit();
  return ok({ ...post });
}

export async function deleteCommunityPost(id: string): Promise<Result<void>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const s = getState();
  const post = s.posts.find((p) => p.id === id);
  if (!post) return fail('NOT_FOUND');
  if (post.authorId !== me.id && !isAdmin()) return fail('FORBIDDEN');

  s.posts = s.posts.filter((p) => p.id !== id);
  s.comments = s.comments.filter((c) => c.postId !== id);
  s.likes = s.likes.filter((l) => l.postId !== id);
  commit();
  return ok(undefined);
}

export async function getComments(postId: string): Promise<Result<CommunityCommentWithAuthor[]>> {
  await delay(100);
  const rows = getState()
    .comments.filter((c) => c.postId === postId)
    .filter((c) => !c.isHidden || isAdmin() || currentUser()?.id === c.authorId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((c) => {
      const author = findProfile(c.authorId);
      return {
        ...c,
        author: {
          id: c.authorId,
          nickname: author?.nickname ?? '알 수 없음',
          avatarUrl: author?.avatarUrl ?? null,
        },
      };
    });
  return ok(rows);
}

export async function createComment(postId: string, content: string): Promise<Result<void>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  if (content.trim().length < 2) return fail('VALIDATION_FAILED', '댓글을 2자 이상 입력해 주세요.');
  const s = getState();
  if (!s.posts.some((p) => p.id === postId)) return fail('NOT_FOUND');

  s.comments.push({
    id: nextId('c'),
    postId,
    authorId: me.id,
    content: content.trim(),
    isHidden: false,
    createdAt: nowIso(),
  });
  recomputePostCounters(s, postId);
  commit();
  return ok(undefined);
}

export async function deleteComment(id: string): Promise<Result<void>> {
  await delay();
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const s = getState();
  const comment = s.comments.find((c) => c.id === id);
  if (!comment) return fail('NOT_FOUND');
  if (comment.authorId !== me.id && !isAdmin()) return fail('FORBIDDEN');
  const postId = comment.postId;
  s.comments = s.comments.filter((c) => c.id !== id);
  recomputePostCounters(s, postId);
  commit();
  return ok(undefined);
}

export async function toggleLike(postId: string): Promise<Result<{ liked: boolean; likeCount: number }>> {
  await delay(90);
  const me = currentUser();
  if (!me) return fail('UNAUTHENTICATED');
  const s = getState();
  const post = s.posts.find((p) => p.id === postId);
  if (!post) return fail('NOT_FOUND');

  const existing = s.likes.find((l) => l.postId === postId && l.userId === me.id);
  if (existing) {
    s.likes = s.likes.filter((l) => l !== existing);
  } else {
    s.likes.push({ id: nextId('l'), postId, userId: me.id, createdAt: nowIso() });
  }
  recomputePostCounters(s, postId);
  commit();
  return ok({ liked: !existing, likeCount: post.likeCount });
}
