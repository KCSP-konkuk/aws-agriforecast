package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 농산물 도매 가격 데이터 (일별)
 */
@Entity
@Table(name = "agri_price", uniqueConstraints = {
        @UniqueConstraint(columnNames = { "ITEM_NAME", "YEAR", "MONTH", "DAY" })
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AgriPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "ITEM_NAME", nullable = false, length = 50)
    private String itemName;

    @Column(name = "YEAR", nullable = false)
    private Integer year;

    @Column(name = "MONTH", nullable = false)
    private Integer month;

    @Column(name = "DAY", nullable = false)
    private Integer day;

    @Column(name = "AVG_PRICE")
    private Double avgPrice;

    @Column(name = "PERIOD_TYPE")
    private String periodType;
}