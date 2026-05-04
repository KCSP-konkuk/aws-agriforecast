package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "exchange_rate_daily", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"BASE_DATE"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ExchangeRateDaily {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "BASE_DATE", nullable = false)
    private LocalDate baseDate;

    @Column(name = "USD_KRW")
    private Double usdKrw;

    @Column(name = "CNY_KRW")
    private Double cnyKrw;
}
