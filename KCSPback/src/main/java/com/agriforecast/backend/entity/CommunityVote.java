package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/** 커뮤니티 '다음 순 오를까' 투표. 품목·대상 순·회원마다 한 표 (다시 누르면 바뀐다) */
@Entity
@Table(name = "community_vote", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"ITEM_NAME", "TARGET_SOON", "MEMBER_ID"})
})
@Getter
@Setter
@NoArgsConstructor
public class CommunityVote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ITEM_NAME", nullable = false, length = 20)
    private String itemName;

    /** 예측 테이블 target_date 와 같은 "202610상순" */
    @Column(name = "TARGET_SOON", nullable = false, length = 16)
    private String targetSoon;

    /** member_user.SEQ_NO_A010 */
    @Column(name = "MEMBER_ID", nullable = false)
    private Integer memberId;

    /** UP · SAME · DOWN */
    @Column(name = "CHOICE", nullable = false, length = 8)
    private String choice;

    @UpdateTimestamp
    @Column(name = "UPDATED_AT", nullable = false)
    private LocalDateTime updatedAt;
}
