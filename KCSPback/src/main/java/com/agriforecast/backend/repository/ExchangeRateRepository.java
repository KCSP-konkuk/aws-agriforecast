package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.ExchangeRate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExchangeRateRepository extends JpaRepository<ExchangeRate, Integer> {

    Optional<ExchangeRate> findByYearAndMonthAndPeriodType(
            Integer year, Integer month, Integer periodType);

    List<ExchangeRate> findByYearBetweenOrderByYearAscMonthAscPeriodTypeAsc(
            Integer startYear, Integer endYear);
}