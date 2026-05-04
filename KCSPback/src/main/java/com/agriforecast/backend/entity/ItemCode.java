package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "item_code")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ItemCode {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "SEQ_NO_A021")
    private Integer seqNoA021;

    @Column(name = "ITEM_NAME", nullable = false, length = 50)
    private String itemName;

    @Column(name = "CATEGORY", nullable = false)
    private Integer category;
    
    // 1:N 관계 - RealItemPrice (역방향)
    // 특정 품목의 모든 가격 정보를 조회할 때 사용 (그래프 그리기, 가격 추이 분석 등)
    @OneToMany(mappedBy = "itemCode", fetch = FetchType.LAZY)
    private List<RealItemPrice> prices = new ArrayList<>();
}
