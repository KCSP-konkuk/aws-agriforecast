package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * 전국 주유소 평균가격 데이터 (일별)
 */
@Entity
@Table(name = "oil_price", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"PRICE_DATE", "PRODUCT_NAME"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OilPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "PRICE_DATE", nullable = false)
    private LocalDate priceDate;

    @Column(name = "PRODUCT_NAME", nullable = false, length = 50)
    private String productName;

    @Column(name = "AVG_PRICE", nullable = false)
    private Double avgPrice;
}
