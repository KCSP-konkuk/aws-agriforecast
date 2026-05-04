package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.SearchTrend;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SearchTrendRepository extends JpaRepository<SearchTrend, Integer> {

    Optional<SearchTrend> findByKeywordAndPeriod(String keyword, LocalDate period);

    List<SearchTrend> findByKeywordAndPeriodBetweenOrderByPeriodAsc(
            String keyword, LocalDate startDate, LocalDate endDate);
}