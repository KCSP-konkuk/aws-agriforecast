package com.agriforecast.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * 지점별 일별 기상 데이터
 * 대상 지점: 무안(165), 창녕(264), 함양(247), 제주(184), 평창(100),
 *            구좌(188), 밀양(288), 태백(216), 해남(261), 괴산(226), 홍성(177)
 */
@Entity
@Table(name = "station_weather_data", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"OBSERVATION_DATE", "STATION_CODE"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class StationWeatherData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "OBSERVATION_DATE", nullable = false)
    private LocalDate observationDate;

    @Column(name = "STATION_CODE", nullable = false)
    private Integer stationCode;


    // ── 당일 관측값 ──────────────────────────────────────────

    @Column(name = "AVG_TEMP")
    private Double avgTemp;           // 일 평균기온 (°C) - TA_AVG

    @Column(name = "MAX_TEMP")
    private Double maxTemp;           // 최고기온 (°C) - TA_MAX

    @Column(name = "MIN_TEMP")
    private Double minTemp;           // 최저기온 (°C) - TA_MIN

    @Column(name = "RAINFALL")
    private Double rainfall;          // 일강수량 (mm) - RN_DAY

    @Column(name = "SUNSHINE_DURATION")
    private Double sunshineDuration;  // 일조시간 (hr) - SS_DAY

    @Column(name = "SOLAR_RADIATION")
    private Double solarRadiation;    // 일사량 (MJ/m²) - SI_DAY

    @Column(name = "AVG_HUMIDITY")
    private Double avgHumidity;       // 일 평균 상대습도 (%) - HM_AVG

    // ── 전년 동기 데이터 (DB 자체 참조) ──────────────────────

    @Column(name = "PREV_YEAR_TEMP")
    private Double prevYearTemp;

    @Column(name = "PREV_YEAR_RAINFALL")
    private Double prevYearRainfall;

    @Column(name = "PREV_YEAR_SUNSHINE")
    private Double prevYearSunshine;

    @Column(name = "PREV_YEAR_SOLAR")
    private Double prevYearSolar;

    @Column(name = "PREV_YEAR_HUMIDITY")
    private Double prevYearHumidity;
}
