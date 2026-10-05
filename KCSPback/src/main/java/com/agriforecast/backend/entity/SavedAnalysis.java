package com.agriforecast.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/** 로그인 사용자가 저장한 분석 작업대 화면. 작업대 상태는 주소(쿼리) 한 줄이라 그대로 저장했다가 다시 연다 */
@Entity
@Table(name = "saved_analysis", indexes = @Index(name = "idx_saved_analysis_member", columnList = "MEMBER_ID"))
@Getter
@Setter
@NoArgsConstructor
public class SavedAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** member_user.SEQ_NO_A010 */
    @Column(name = "MEMBER_ID", nullable = false)
    private Integer memberId;

    @Column(name = "TITLE", nullable = false, length = 100)
    private String title;

    @Column(name = "MEMO", length = 500)
    private String memo;

    /** 작업대 주소의 쿼리 부분 (s=…&t=…&f=…) */
    @Column(name = "QUERY_STRING", nullable = false, length = 2000)
    private String query;

    @CreationTimestamp
    @Column(name = "CREATED_AT", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "UPDATED_AT", nullable = false)
    private LocalDateTime updatedAt;
}
