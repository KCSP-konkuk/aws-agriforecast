package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {
    
    // 카테고리별 게시글 조회 (페이징) - user와 user.memberProfile 함께 fetch
    @EntityGraph(attributePaths = {"user", "user.memberProfile"})
    Page<Post> findByCategoryOrderByCreatedAtDesc(String category, Pageable pageable);
    
    // 전체 게시글 조회 (페이징) - user와 user.memberProfile 함께 fetch
    @EntityGraph(attributePaths = {"user", "user.memberProfile"})
    Page<Post> findAllByOrderByCreatedAtDesc(Pageable pageable);
    
    // 게시글 상세 조회 (user와 user.memberProfile 함께 fetch)
    @EntityGraph(attributePaths = {"user", "user.memberProfile"})
    @Query("SELECT p FROM Post p WHERE p.seqNoA030 = :id")
    Optional<Post> findByIdWithUser(@Param("id") Long id);
    
    // 사용자별 게시글 조회 (MemberUser의 seqNoA010 사용)
    @Query("SELECT p FROM Post p WHERE p.user.seqNoA010 = :userId ORDER BY p.createdAt DESC")
    List<Post> findByUserIdOrderByCreatedAtDesc(@Param("userId") Integer userId);
    
    // 제목으로 검색
    Page<Post> findByTitleContainingOrderByCreatedAtDesc(String title, Pageable pageable);
    
    // 카테고리와 제목으로 검색
    Page<Post> findByCategoryAndTitleContainingOrderByCreatedAtDesc(String category, String title, Pageable pageable);
}

