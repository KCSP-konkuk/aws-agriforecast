package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 소비자물가지수 (월별, 품목별)
 */
@Entity
@Table(name = "cpi_data", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"YEAR", "MONTH", "ITEM_NAME"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CpiData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "YEAR", nullable = false)
    private Integer year;

    @Column(name = "MONTH", nullable = false)
    private Integer month;

    @Column(name = "ITEM_NAME", nullable = false, length = 50)
    private String itemName;

    @Column(name = "CPI", nullable = false)
    private Double cpi;
}
