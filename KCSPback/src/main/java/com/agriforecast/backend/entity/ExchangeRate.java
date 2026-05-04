package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 환율 데이터 (순별)
 * periodType: 0=상순, 1=중순, 2=하순
 */
@Entity
@Table(name = "exchange_rate", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"YEAR", "MONTH", "PERIOD_TYPE"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ExchangeRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "YEAR", nullable = false)
    private Integer year;

    @Column(name = "MONTH", nullable = false)
    private Integer month;

    // 0=상순, 1=중순, 2=하순
    @Column(name = "PERIOD_TYPE", nullable = false)
    private Integer periodType;

    // 원/달러
    @Column(name = "USD_KRW")
    private Double usdKrw;

    @Column(name = "USD_CHANGE_RATE")
    private Double usdChangeRate;

    // 원/위안
    @Column(name = "CNY_KRW")
    private Double cnyKrw;

    @Column(name = "CNY_CHANGE_RATE")
    private Double cnyChangeRate;
}