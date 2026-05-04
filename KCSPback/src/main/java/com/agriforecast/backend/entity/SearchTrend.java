package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "search_trend", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"KEYWORD", "PERIOD"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SearchTrend {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "KEYWORD", nullable = false, length = 50)
    private String keyword;

    @Column(name = "PERIOD", nullable = false)
    private LocalDate period;

    // 네이버 데이터랩 기준 상대 검색량 (0~100)
    @Column(name = "RATIO", nullable = false)
    private Double ratio;
}
