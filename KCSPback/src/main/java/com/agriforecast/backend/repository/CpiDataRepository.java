package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.CpiData;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CpiDataRepository extends JpaRepository<CpiData, Integer> {

    Optional<CpiData> findByYearAndMonthAndItemName(Integer year, Integer month, String itemName);

    List<CpiData> findByYearBetweenOrderByYearAscMonthAsc(Integer startYear, Integer endYear);
}
