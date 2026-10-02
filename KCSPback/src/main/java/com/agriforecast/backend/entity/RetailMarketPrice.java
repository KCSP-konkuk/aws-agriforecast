package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * KAMIS 소매가격 (일별, 서울 판매처별, 상품 등급)
 * 서울 평균(retail_price)은 판매처 구성이 바뀌면 가격 변화 없이 출렁여서, 소매 모델은 판매처별 값
 * (경동·복조리 등 전통시장)으로 목표를 만든다. 대형유통은 KAMIS 가 'A-유통' 처럼 익명으로 준다
 */
@Entity
@Table(name = "retail_market_price", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"ITEM_NAME", "PRICE_DATE", "MARKET_NAME"})
})
@Getter
@Setter
@NoArgsConstructor
public class RetailMarketPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "ITEM_NAME", nullable = false, length = 50)
    private String itemName;

    @Column(name = "PRICE_DATE", nullable = false)
    private LocalDate priceDate;

    /** KAMIS marketname 그대로 (경동, 복조리, A-유통 …) */
    @Column(name = "MARKET_NAME", nullable = false, length = 30)
    private String marketName;

    /** 소매가 (원, 조사 단위 기준 — 양파 1kg / 붉은고추 100g / 양배추 1포기 / 애호박 1개 / 시금치 100g / 오이 10개) */
    @Column(name = "PRICE", nullable = false)
    private Integer price;
}
