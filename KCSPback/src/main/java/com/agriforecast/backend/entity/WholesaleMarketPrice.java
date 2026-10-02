package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * KAMIS 도매가격 (일별, 서울 시장별, 상품 등급) — 16번 periodWholesaleProductList
 * 서울은 '가락도매'(가락시장 중도매인 판매가) 한 곳이다. 소매 모델에서 농넷 가락 경매가가 없는 품목(애호박·시금치)의
 * 가락 자리에 쓴다 (redpepper docs/RETAIL.md 12절 — 기존 3품목에서 경매가 대신 넣어도 검증 MASE ±0.03 안)
 */
@Entity
@Table(name = "wholesale_market_price", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"ITEM_NAME", "PRICE_DATE", "MARKET_NAME"})
})
@Getter
@Setter
@NoArgsConstructor
public class WholesaleMarketPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "ITEM_NAME", nullable = false, length = 50)
    private String itemName;

    @Column(name = "PRICE_DATE", nullable = false)
    private LocalDate priceDate;

    /** KAMIS marketname 그대로 (가락도매) */
    @Column(name = "MARKET_NAME", nullable = false, length = 30)
    private String marketName;

    /** 도매가 (원, KAMIS 도매 거래 단위 기준). 소매 모델은 변화율·비율로만 써서 단위에 영향받지 않는다 */
    @Column(name = "PRICE", nullable = false)
    private Integer price;
}
