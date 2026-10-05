package com.agriforecast.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PostResponse {
    
    private Long id;
    private String title;
    private String category;
    private String kind;  // USER · BRIEF
    private String content;
    private String analysisQuery;  // 붙인 분석 작업대 화면(주소의 쿼리), 없으면 null
    private Integer viewCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // 작성자 정보
    private Integer authorId;  // MemberUser의 seqNoA010
    private String authorName;  // MemberProfile의 name
    
    // 댓글 개수
    private Long commentCount;
}

