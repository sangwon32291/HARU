/**
 * community 서비스 — 데이터 소스 분기.
 *
 * VITE_DATA_SOURCE 값에 따라 mock(샘플 데이터) 또는 supabase(실제 DB) 구현으로 연결합니다.
 * 두 구현은 함수 시그니처가 같으므로 화면 코드는 이 파일만 import 하면 됩니다.
 */
import { IS_SUPABASE } from './config';
import * as mock from './mock/community';
import * as sb from './supabase/community';

export const getCommunityPosts = IS_SUPABASE ? sb.getCommunityPosts : mock.getCommunityPosts;
export const getCommunityPost = IS_SUPABASE ? sb.getCommunityPost : mock.getCommunityPost;
export const createCommunityPost = IS_SUPABASE ? sb.createCommunityPost : mock.createCommunityPost;
export const updateCommunityPost = IS_SUPABASE ? sb.updateCommunityPost : mock.updateCommunityPost;
export const deleteCommunityPost = IS_SUPABASE ? sb.deleteCommunityPost : mock.deleteCommunityPost;
export const getComments = IS_SUPABASE ? sb.getComments : mock.getComments;
export const createComment = IS_SUPABASE ? sb.createComment : mock.createComment;
export const deleteComment = IS_SUPABASE ? sb.deleteComment : mock.deleteComment;
export const toggleLike = IS_SUPABASE ? sb.toggleLike : mock.toggleLike;
