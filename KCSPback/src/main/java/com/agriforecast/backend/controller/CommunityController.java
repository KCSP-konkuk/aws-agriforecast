package com.agriforecast.backend.controller;

import com.agriforecast.backend.dto.CommentRequest;
import com.agriforecast.backend.dto.CommentResponse;
import com.agriforecast.backend.dto.PostRequest;
import com.agriforecast.backend.dto.PostResponse;
import com.agriforecast.backend.service.CommentService;
import com.agriforecast.backend.service.PostService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/community")
@CrossOrigin(origins = "http://localhost:5173")
public class CommunityController {
    
    @Autowired
    private PostService postService;
    
    @Autowired
    private CommentService commentService;
    
    // 게시글 목록 조회 (전체)
    @GetMapping("/posts")
    public ResponseEntity<Page<PostResponse>> getAllPosts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        try {
            Pageable pageable = PageRequest.of(page, size);
            Page<PostResponse> posts = postService.getAllPosts(pageable);
            return ResponseEntity.ok(posts);
        } catch (Exception e) {
            e.printStackTrace();
            // 에러 발생 시에도 빈 페이지 반환 (에러 로그는 이미 Service에서 출력됨)
            Pageable pageable = PageRequest.of(page, size);
            return ResponseEntity.ok(Page.empty(pageable));
        }
    }
    
    // 게시글 목록 조회 (카테고리별)
    @GetMapping("/posts/category/{category}")
    public ResponseEntity<Page<PostResponse>> getPostsByCategory(
            @PathVariable String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        try {
            // URL 디코딩 (한글 카테고리 이름 처리)
            String decodedCategory = java.net.URLDecoder.decode(category, "UTF-8");
            Pageable pageable = PageRequest.of(page, size);
            Page<PostResponse> posts = postService.getPostsByCategory(decodedCategory, pageable);
            return ResponseEntity.ok(posts);
        } catch (Exception e) {
            e.printStackTrace();
            // 에러 발생 시에도 빈 페이지 반환
            Pageable pageable = PageRequest.of(page, size);
            return ResponseEntity.ok(Page.empty(pageable));
        }
    }
    
    // 게시글 상세 조회
    @GetMapping("/posts/{id}")
    public ResponseEntity<PostResponse> getPostById(@PathVariable Long id) {
        try {
            PostResponse post = postService.getPostById(id);
            return ResponseEntity.ok(post);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }
    
    // 게시글 작성
    @PostMapping("/posts")
    public ResponseEntity<?> createPost(
            @RequestBody PostRequest request,
            @RequestHeader("X-User-Id") Integer userId) {
        try {
            PostResponse post = postService.createPost(request, userId);
            return ResponseEntity.status(HttpStatus.CREATED).body(post);
        } catch (RuntimeException e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(java.util.Map.of("message", e.getMessage() != null ? e.getMessage() : "게시글 작성에 실패했습니다."));
        }
    }
    
    // 게시글 수정
    @PutMapping("/posts/{id}")
    public ResponseEntity<PostResponse> updatePost(
            @PathVariable Long id,
            @RequestBody PostRequest request,
            @RequestHeader("X-User-Id") Integer userId) {
        try {
            PostResponse post = postService.updatePost(id, request, userId);
            return ResponseEntity.ok(post);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }
    
    // 게시글 삭제
    @DeleteMapping("/posts/{id}")
    public ResponseEntity<Void> deletePost(
            @PathVariable Long id,
            @RequestHeader("X-User-Id") Integer userId) {
        try {
            postService.deletePost(id, userId);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }
    
    // 댓글 목록 조회
    @GetMapping("/posts/{postId}/comments")
    public ResponseEntity<List<CommentResponse>> getComments(@PathVariable Long postId) {
        List<CommentResponse> comments = commentService.getCommentsByPostId(postId);
        return ResponseEntity.ok(comments);
    }
    
    // 댓글 작성
    @PostMapping("/posts/{postId}/comments")
    public ResponseEntity<CommentResponse> createComment(
            @PathVariable Long postId,
            @RequestBody CommentRequest request,
            @RequestHeader("X-User-Id") Integer userId) {
        try {
            CommentResponse comment = commentService.createComment(postId, request, userId);
            return ResponseEntity.status(HttpStatus.CREATED).body(comment);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }
    
    // 댓글 수정
    @PutMapping("/comments/{id}")
    public ResponseEntity<CommentResponse> updateComment(
            @PathVariable Long id,
            @RequestBody CommentRequest request,
            @RequestHeader("X-User-Id") Integer userId) {
        try {
            CommentResponse comment = commentService.updateComment(id, request, userId);
            return ResponseEntity.ok(comment);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }
    
    // 댓글 삭제
    @DeleteMapping("/comments/{id}")
    public ResponseEntity<Void> deleteComment(
            @PathVariable Long id,
            @RequestHeader("X-User-Id") Integer userId) {
        try {
            commentService.deleteComment(id, userId);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }
}

