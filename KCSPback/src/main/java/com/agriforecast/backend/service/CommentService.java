package com.agriforecast.backend.service;

import com.agriforecast.backend.dto.CommentRequest;
import com.agriforecast.backend.dto.CommentResponse;
import com.agriforecast.backend.entity.Comment;
import com.agriforecast.backend.entity.MemberUser;
import com.agriforecast.backend.entity.Post;
import com.agriforecast.backend.repository.CommentRepository;
import com.agriforecast.backend.repository.MemberUserRepository;
import com.agriforecast.backend.repository.PostRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Transactional
public class CommentService {
    
    private static final Logger logger = LoggerFactory.getLogger(CommentService.class);
    
    @Autowired
    private CommentRepository commentRepository;
    
    @Autowired
    private PostRepository postRepository;
    
    @Autowired
    private MemberUserRepository memberUserRepository;
    
    // 댓글 목록 조회
    public List<CommentResponse> getCommentsByPostId(Long postId) {
        return commentRepository.findByPostIdOrderByCreatedAtAsc(postId)
            .stream()
            .map(this::convertToResponse)
            .collect(Collectors.toList());
    }
    
    // 댓글 작성
    public CommentResponse createComment(Long postId, CommentRequest request, Integer userId) {
        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isEmpty()) {
            throw new RuntimeException("게시글을 찾을 수 없습니다.");
        }
        
        Optional<MemberUser> userOpt = memberUserRepository.findById(userId);
        if (userOpt.isEmpty()) {
            throw new RuntimeException("사용자를 찾을 수 없습니다.");
        }
        
        Comment comment = new Comment();
        comment.setPost(postOpt.get());
        comment.setUser(userOpt.get());
        comment.setContent(request.getContent());
        
        Comment savedComment = commentRepository.save(comment);
        logger.info("댓글 작성 완료 - ID: {}, 게시글 ID: {}", savedComment.getSeqNoA031(), postId);
        
        return convertToResponse(savedComment);
    }
    
    // 댓글 수정
    public CommentResponse updateComment(Long id, CommentRequest request, Integer userId) {
        Optional<Comment> commentOpt = commentRepository.findById(id);
        if (commentOpt.isEmpty()) {
            throw new RuntimeException("댓글을 찾을 수 없습니다.");
        }
        
        Comment comment = commentOpt.get();
        
        // 작성자 확인
        if (!comment.getUser().getSeqNoA010().equals(userId)) {
            throw new RuntimeException("댓글 수정 권한이 없습니다.");
        }
        
        comment.setContent(request.getContent());
        
        Comment updatedComment = commentRepository.save(comment);
        logger.info("댓글 수정 완료 - ID: {}", updatedComment.getSeqNoA031());
        
        return convertToResponse(updatedComment);
    }
    
    // 댓글 삭제
    public void deleteComment(Long id, Integer userId) {
        Optional<Comment> commentOpt = commentRepository.findById(id);
        if (commentOpt.isEmpty()) {
            throw new RuntimeException("댓글을 찾을 수 없습니다.");
        }
        
        Comment comment = commentOpt.get();
        
        // 작성자 확인
        if (!comment.getUser().getSeqNoA010().equals(userId)) {
            throw new RuntimeException("댓글 삭제 권한이 없습니다.");
        }
        
        commentRepository.delete(comment);
        logger.info("댓글 삭제 완료 - ID: {}", id);
    }
    
    // Entity를 Response로 변환
    private CommentResponse convertToResponse(Comment comment) {
        CommentResponse response = new CommentResponse();
        response.setId(comment.getSeqNoA031());
        response.setContent(comment.getContent());
        response.setCreatedAt(comment.getCreatedAt());
        response.setUpdatedAt(comment.getUpdatedAt());
        
        // 작성자 정보
        response.setAuthorId(comment.getUser().getSeqNoA010());
        if (comment.getUser().getMemberProfile() != null) {
            response.setAuthorName(comment.getUser().getMemberProfile().getName());
        } else {
            response.setAuthorName(comment.getUser().getId()); // 프로필이 없으면 ID 사용
        }
        
        return response;
    }
}

