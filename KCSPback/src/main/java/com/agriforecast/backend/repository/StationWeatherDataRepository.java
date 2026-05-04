package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.StationWeatherData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface StationWeatherDataRepository extends JpaRepository<StationWeatherData, Long> {

    Optional<StationWeatherData> findByObservationDateAndStationCode(LocalDate date, Integer stationCode);

    boolean existsByObservationDateAndStationCode(LocalDate date, Integer stationCode);

    @Query("SELECT s FROM StationWeatherData s " +
           "WHERE s.observationDate BETWEEN :start AND :end " +
           "ORDER BY s.observationDate ASC, s.stationCode ASC")
    List<StationWeatherData> findByDateRange(
            @Param("start") LocalDate start,
            @Param("end") LocalDate end);

    /** CSV 중복 체크용: 이미 저장된 "날짜_지점코드" 키 목록 */
    @Query(value = "SELECT CONCAT(observation_date, '_', station_code) FROM station_weather_data", nativeQuery = true)
    List<String> findAllDateStationKeys();
}