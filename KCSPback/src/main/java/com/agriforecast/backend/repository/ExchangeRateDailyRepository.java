package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.ExchangeRateDaily;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ExchangeRateDailyRepository extends JpaRepository<ExchangeRateDaily, Long> {

    Optional<ExchangeRateDaily> findByBaseDate(LocalDate baseDate);

    List<ExchangeRateDaily> findByBaseDateBetweenOrderByBaseDateAsc(
            LocalDate startDate, LocalDate endDate);
}
