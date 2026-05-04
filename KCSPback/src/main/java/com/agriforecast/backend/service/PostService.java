package com.agriforecast.backend.service;

import com.agriforecast.backend.dto.PostRequest;
import com.agriforecast.backend.dto.PostResponse;
import com.agriforecast.backend.entity.MemberUser;
import com.agriforecast.backend.entity.Post;
import com.agriforecast.backend.repository.CommentRepository;
import com.agriforecast.backend.repository.MemberUserRepository;
import com.agriforecast.backend.repository.PostRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@Transactional
public class PostService {
    
    private static final Logger logger = LoggerFactory.getLogger(PostService.class);
    
    @Autowired
    private PostRepository postRepository;
    
    @Autowired
    private MemberUserRepository memberUserRepository;
    
    @Autowired
    private CommentRepository commentRepository;
    
    // 게시글 목록 조회 (전체)
    public Page<PostResponse> getAllPosts(Pageable pageable) {
        logger.info("전체 게시글 조회 요청 - page: {}, size: {}", pageable.getPageNumber(), pageable.getPageSize());
        Page<Post> posts = postRepository.findAllByOrderByCreatedAtDesc(pageable);
        logger.info("조회된 게시글 수: {}", posts.getTotalElements());
        return posts.map(this::convertToResponse);
    }
    
    // 게시글 목록 조회 (카테고리별)
    public Page<PostResponse> getPostsByCategory(String category, Pageable pageable) {
        logger.info("카테고리별 게시글 조회 요청 - category: {}, page: {}, size: {}", category, pageable.getPageNumber(), pageable.getPageSize());
        Page<Post> posts = postRepository.findByCategoryOrderByCreatedAtDesc(category, pageable);
        logger.info("조회된 게시글 수: {}", posts.getTotalElements());
        return posts.map(this::convertToResponse);
    }
    
    // 게시글 상세 조회
    public PostResponse getPostById(Long id) {
        Optional<Post> postOpt = postRepository.findByIdWithUser(id);
        if (postOpt.isEmpty()) {
            throw new RuntimeException("게시글을 찾을 수 없습니다.");
        }
        
        Post post = postOpt.get();
        // 조회수 증가
        post.setViewCount(post.getViewCount() + 1);
        postRepository.save(post);
        
        return convertToResponse(post);
    }
    
    // 게시글 작성
    public PostResponse createPost(PostRequest request, Integer userId) {
        Optional<MemberUser> userOpt = memberUserRepository.findById(userId);
        if (userOpt.isEmpty()) {
            throw new RuntimeException("사용자를 찾을 수 없습니다.");
        }
        
        Post post = new Post();
        post.setUser(userOpt.get());
        post.setTitle(request.getTitle());
        post.setCategory(request.getCategory());
        post.setContent(request.getContent());
        post.setViewCount(0);
        
        Post savedPost = postRepository.save(post);
        logger.info("게시글 작성 완료 - ID: {}, 제목: {}", savedPost.getSeqNoA030(), savedPost.getTitle());
        
        return convertToResponse(savedPost);
    }
    
    // 게시글 수정
    public PostResponse updatePost(Long id, PostRequest request, Integer userId) {
        Optional<Post> postOpt = postRepository.findById(id);
        if (postOpt.isEmpty()) {
            throw new RuntimeException("게시글을 찾을 수 없습니다.");
        }
        
        Post post = postOpt.get();
        
        // 작성자 확인
        if (!post.getUser().getSeqNoA010().equals(userId)) {
            throw new RuntimeException("게시글 수정 권한이 없습니다.");
        }
        
        post.setTitle(request.getTitle());
        post.setCategory(request.getCategory());
        post.setContent(request.getContent());
        
        Post updatedPost = postRepository.save(post);
        logger.info("게시글 수정 완료 - ID: {}", updatedPost.getSeqNoA030());
        
        return convertToResponse(updatedPost);
    }
    
    // 게시글 삭제
    public void deletePost(Long id, Integer userId) {
        Optional<Post> postOpt = postRepository.findById(id);
        if (postOpt.isEmpty()) {
            throw new RuntimeException("게시글을 찾을 수 없습니다.");
        }
        
        Post post = postOpt.get();
        
        // 작성자 확인
        if (!post.getUser().getSeqNoA010().equals(userId)) {
            throw new RuntimeException("게시글 삭제 권한이 없습니다.");
        }
        
        postRepository.delete(post);
        logger.info("게시글 삭제 완료 - ID: {}", id);
    }
    
    // Entity를 Response로 변환
    private PostResponse convertToResponse(Post post) {
        try {
            PostResponse response = new PostResponse();
            response.setId(post.getSeqNoA030());
            response.setTitle(post.getTitle());
            response.setCategory(post.getCategory());
            response.setContent(post.getContent());
            response.setViewCount(post.getViewCount());
            response.setCreatedAt(post.getCreatedAt());
            response.setUpdatedAt(post.getUpdatedAt());
            
            // 작성자 정보 - EntityNotFoundException 처리
            try {
                if (post.getUser() != null) {
                    MemberUser user = post.getUser();
                    response.setAuthorId(user.getSeqNoA010());
                    
                    // MemberProfile이 있는지 확인
                    try {
                        if (user.getMemberProfile() != null && user.getMemberProfile().getName() != null) {
                            response.setAuthorName(user.getMemberProfile().getName());
                        } else {
                            response.setAuthorName(user.getId() != null ? user.getId() : "익명");
                        }
                    } catch (jakarta.persistence.EntityNotFoundException e) {
                        logger.warn("Post ID {}의 작성자 프로필을 찾을 수 없습니다. ID를 사용합니다.", post.getSeqNoA030());
                        response.setAuthorName(user.getId() != null ? user.getId() : "익명");
                    }
                } else {
                    response.setAuthorId(null);
                    response.setAuthorName("익명");
                }
            } catch (jakarta.persistence.EntityNotFoundException e) {
                logger.warn("Post ID {}의 작성자(MemberUser)를 찾을 수 없습니다. 익명으로 처리합니다.", post.getSeqNoA030());
                response.setAuthorId(null);
                response.setAuthorName("익명");
            } catch (Exception e) {
                logger.warn("Post ID {}의 작성자 정보 조회 중 오류 발생: {}", post.getSeqNoA030(), e.getMessage());
                response.setAuthorId(null);
                response.setAuthorName("익명");
            }
            
            // 댓글 개수 (Repository에서 직접 조회하여 LAZY 로딩 문제 방지)
            try {
                response.setCommentCount(commentRepository.countByPostId(post.getSeqNoA030()));
            } catch (Exception e) {
                logger.warn("댓글 개수 조회 실패 - postId: {}, error: {}", post.getSeqNoA030(), e.getMessage());
                response.setCommentCount(0L);
            }
            
            return response;
        } catch (Exception e) {
            logger.error("PostResponse 변환 실패 - postId: {}, error: {}", post.getSeqNoA030(), e.getMessage(), e);
            // 최소한의 정보라도 반환
            PostResponse response = new PostResponse();
            response.setId(post.getSeqNoA030());
            response.setTitle(post.getTitle() != null ? post.getTitle() : "");
            response.setCategory(post.getCategory() != null ? post.getCategory() : "");
            response.setContent(post.getContent() != null ? post.getContent() : "");
            response.setViewCount(post.getViewCount() != null ? post.getViewCount() : 0);
            response.setAuthorName("익명");
            response.setCommentCount(0L);
            return response;
        }
    }
}

