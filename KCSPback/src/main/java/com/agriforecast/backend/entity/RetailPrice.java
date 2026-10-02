package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * KAMIS 소매가격 (일별, 서울 평균, 상품 등급)
 * 서울 조사 판매처(전통시장·대형유통) 값의 평균 — KAMIS 응답의 '평균' 행 그대로
 */
@Entity
@Table(name = "retail_price", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"ITEM_NAME", "PRICE_DATE"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RetailPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "ITEM_NAME", nullable = false, length = 50)
    private String itemName;

    @Column(name = "PRICE_DATE", nullable = false)
    private LocalDate priceDate;

    /** 서울 평균 소매가 (원, 조사 단위 기준 — 양파 1kg / 붉은고추 100g / 양배추 1포기 / 애호박 1개 / 시금치 100g / 오이 10개) */
    @Column(name = "PRICE", nullable = false)
    private Integer price;

    @Column(name = "UNIT", length = 20)
    private String unit;

    /** 그날 값이 있던 서울 판매처 수 */
    @Column(name = "MARKET_COUNT")
    private Integer marketCount;
}
