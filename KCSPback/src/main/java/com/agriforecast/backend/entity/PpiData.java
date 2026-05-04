package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 생산자물가지수 (월별, 품목별)
 */
@Entity
@Table(name = "ppi_data", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"YEAR", "MONTH", "ITEM_NAME"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PpiData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "YEAR", nullable = false)
    private Integer year;

    @Column(name = "MONTH", nullable = false)
    private Integer month;

    @Column(name = "ITEM_NAME", nullable = false, length = 50)
    private String itemName;

    @Column(name = "PPI", nullable = false)
    private Double ppi;
}
