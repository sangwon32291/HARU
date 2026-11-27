import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Eye, Heart, MessageSquare, Search, Trash2 } from 'lucide-react';
import {
  createComment,
  createCommunityPost,
  deleteComment,
  deleteCommunityPost,
  getCommunityPost,
  getCommunityPosts,
  getComments,
  toggleLike,
} from '@/services/community';
import { createReport, REPORT_REASONS } from '@/services/reports';
import type { CommunityCommentWithAuthor, CommunityPostWithAuthor } from '@/types/database';
import { COMMUNITY_CATEGORY, COMMUNITY_CATEGORY_LABEL, type CommunityCategory } from '@/types/enums';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/components/ui/toast';
import { Badge, Button, EmptyState, ErrorState, Field, Input, Modal, Select, SkeletonList, Spinner, Tabs, Textarea } from '@/components/ui';
import { PageHeader } from '@/components/layout/AppLayout';
import { cn, formatRelativeTime } from '@/lib/format';

const CATEGORY_TONE: Record<CommunityCategory, 'primary' | 'warn' | 'neutral' | 'danger'> = {
  review: 'primary',
  info: 'neutral',
  free: 'neutral',
  caution: 'danger',
};

/* ─────────────────────── 목록 ─────────────────────── */

export function CommunityPage() {
  const [params, setParams] = useSearchParams();
  const category = (params.get('category') as CommunityCategory | null) ?? null;
  const keyword = params.get('q') ?? '';

  const [posts, setPosts] = useState<CommunityPostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState(keyword);

  useEffect(() => {
    setLoading(true);
    getCommunityPosts({ category, keyword }).then((res) => {
      setPosts(res.data ?? []);
      setLoading(false);
    });
  }, [category, keyword]);

  const patch = (next: Record<string, string | null>) => {
    const merged = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (!v) merged.delete(k);
      else merged.set(k, v);
    }
    setParams(merged, { replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="커뮤니티"
        description="일자리 정보와 근무 경험을 나누는 공간입니다"
        action={
          <Link to="/community/new">
            <Button size="sm">글쓰기</Button>
          </Link>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          patch({ q: searchText.trim() || null });
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-haru-sub" aria-hidden />
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="게시글 검색"
          aria-label="게시글 검색"
          className="h-11 w-full rounded-xl border border-haru-border bg-white pl-10 pr-3 text-sm focus:border-haru-primary focus:outline-none"
        />
      </form>

      <Tabs
        value={category ?? 'all'}
        onChange={(next) => patch({ category: next === 'all' ? null : next })}
        items={[
          { value: 'all', label: '전체' },
          ...COMMUNITY_CATEGORY.map((c) => ({ value: c, label: COMMUNITY_CATEGORY_LABEL[c] })),
        ]}
      />

      {loading ? (
        <SkeletonList />
      ) : posts.length === 0 ? (
        <EmptyState
          title="게시글이 없습니다"
          description={keyword ? '다른 검색어로 시도해 보세요.' : '첫 글을 남겨보세요.'}
          action={
            <Link to="/community/new">
              <Button>글쓰기</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <Link key={post.id} to={`/community/${post.id}`} className="block rounded-2xl border border-haru-border bg-white p-4 shadow-card transition-colors hover:border-haru-primary/40">
              <div className="flex items-center gap-2">
                <Badge tone={CATEGORY_TONE[post.category]}>{COMMUNITY_CATEGORY_LABEL[post.category]}</Badge>
                {post.isHidden && <Badge tone="danger">숨김 처리됨</Badge>}
              </div>
              <h3 className="mt-2 truncate font-bold">{post.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-haru-sub">{post.content}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-haru-sub">
                <span>{post.author.nickname}</span>
                <span>{formatRelativeTime(post.createdAt)}</span>
                <span className="ml-auto flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" aria-hidden /> {post.viewCount}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className={cn('h-3.5 w-3.5', post.likedByMe && 'fill-haru-danger text-haru-danger')} aria-hidden />{' '}
                  {post.likeCount}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden /> {post.commentCount}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── 상세 ─────────────────────── */

export function CommunityDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [post, setPost] = useState<CommunityPostWithAuthor | null>(null);
  const [comments, setComments] = useState<CommunityCommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);

  const load = useCallback(() => {
    setLoading(true);
    getCommunityPost(id).then((res) => {
      if (res.error) setError(res.error.message);
      else setPost(res.data);
      setLoading(false);
    });
    getComments(id).then((res) => setComments(res.data ?? []));
  }, [id]);

  useEffect(load, [load]);

  if (loading) return <Spinner label="게시글을 불러오는 중" />;
  if (error || !post) return <ErrorState message={error ?? '게시글을 찾을 수 없습니다.'} />;

  const isAuthor = user?.id === post.authorId;

  const handleLike = async () => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/community/${id}`)}`);
      return;
    }
    const res = await toggleLike(id);
    if (res.error) toast(res.error.message, 'error');
    else load();
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/community/${id}`)}`);
      return;
    }
    const res = await createComment(id, commentText);
    if (res.error) toast(res.error.message, 'error');
    else {
      setCommentText('');
      load();
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm('게시글을 삭제하시겠습니까?')) return;
    const res = await deleteCommunityPost(id);
    if (res.error) toast(res.error.message, 'error');
    else {
      toast('게시글을 삭제했습니다.');
      navigate('/community');
    }
  };

  const handleReport = async () => {
    const res = await createReport({ targetType: 'community_post', targetId: id, reason: reportReason });
    if (res.error) toast(res.error.message, 'error');
    else toast('신고가 접수되었습니다.', 'success');
    setReportOpen(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="" backTo="/community" />

      <article className="haru-card p-4">
        <Badge tone={CATEGORY_TONE[post.category]}>{COMMUNITY_CATEGORY_LABEL[post.category]}</Badge>
        <h1 className="mt-2 text-[22px] font-black leading-snug">{post.title}</h1>
        <p className="mt-1 text-xs text-haru-sub">
          {post.author.nickname} · {formatRelativeTime(post.createdAt)} · 조회 {post.viewCount}
        </p>

        <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed">{post.content}</p>

        <div className="mt-6 flex items-center gap-2">
          <Button
            variant={post.likedByMe ? 'secondary' : 'outline'}
            size="sm"
            onClick={handleLike}
            icon={<Heart className={cn('h-4 w-4', post.likedByMe && 'fill-haru-danger text-haru-danger')} aria-hidden />}
          >
            좋아요 {post.likeCount}
          </Button>
          {isAuthor ? (
            <Button variant="danger" size="sm" onClick={handleDeletePost} icon={<Trash2 className="h-4 w-4" aria-hidden />}>
              삭제
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (user ? setReportOpen(true) : navigate('/login'))}
              icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
            >
              신고
            </Button>
          )}
        </div>
      </article>

      <section className="haru-card p-4">
        <h2 className="mb-3 text-[17px] font-bold">댓글 {comments.length}</h2>

        <form onSubmit={handleComment} className="mb-4 flex gap-2">
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={user ? '댓글을 입력하세요' : '로그인 후 댓글을 남길 수 있습니다'}
            aria-label="댓글 입력"
            className="h-11 flex-1 rounded-xl border border-haru-border px-3 text-sm focus:border-haru-primary focus:outline-none"
          />
          <Button type="submit" disabled={!commentText.trim()}>
            등록
          </Button>
        </form>

        {comments.length === 0 ? (
          <p className="py-6 text-center text-sm text-haru-sub">첫 댓글을 남겨보세요.</p>
        ) : (
          <ul className="divide-y divide-haru-border">
            {comments.map((comment) => (
              <li key={comment.id} className="py-3">
                <div className="flex items-start gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-haru-secondary text-xs font-bold text-haru-primary-dark">
                    {comment.author.nickname.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">
                      {comment.author.nickname}
                      <span className="ml-1.5 font-normal text-haru-sub">{formatRelativeTime(comment.createdAt)}</span>
                    </p>
                    <p className="mt-1 text-sm leading-relaxed">{comment.content}</p>
                  </div>
                  {user?.id === comment.authorId && (
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteComment(comment.id);
                        load();
                      }}
                      className="shrink-0 text-xs text-haru-sub hover:text-haru-danger"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="게시글 신고"
        footer={
          <>
            <Button variant="outline" fullWidth onClick={() => setReportOpen(false)}>
              취소
            </Button>
            <Button variant="danger" fullWidth onClick={handleReport}>
              신고 접수
            </Button>
          </>
        }
      >
        <Select value={reportReason} onChange={(e) => setReportReason(e.target.value)} aria-label="신고 사유">
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </Modal>
    </div>
  );
}

/* ─────────────────────── 글 작성 ─────────────────────── */

export function CommunityFormPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState({ category: 'free' as CommunityCategory, title: '', content: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await createCommunityPost(form);
    setSubmitting(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    toast('글을 등록했습니다.', 'success');
    navigate(`/community/${res.data.id}`);
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="글쓰기" backTo="/community" />

      <section className="haru-card space-y-4 p-4">
        <Field label="게시판" required htmlFor="c-category">
          <Select
            id="c-category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as CommunityCategory })}
          >
            {COMMUNITY_CATEGORY.map((c) => (
              <option key={c} value={c}>
                {COMMUNITY_CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="제목" required htmlFor="c-title">
          <Input id="c-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </Field>
        <Field
          label="내용"
          required
          error={error}
          hint="허위 사실 단정, 개인정보(실명·연락처) 노출, 악성 비방은 신고 및 숨김 처리될 수 있습니다."
          htmlFor="c-content"
        >
          <Textarea
            id="c-content"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="min-h-[200px]"
            required
          />
        </Field>
      </section>

      <div className="flex gap-2 pb-6">
        <Button type="button" variant="outline" fullWidth onClick={() => navigate(-1)}>
          취소
        </Button>
        <Button type="submit" fullWidth size="lg" loading={submitting}>
          등록
        </Button>
      </div>
    </form>
  );
}
