package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.AgriPrice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AgriPriceRepository extends JpaRepository<AgriPrice, Integer> {

    Optional<AgriPrice> findByItemNameAndYearAndMonthAndDay(
            String itemName, Integer year, Integer month, Integer day);

    List<AgriPrice> findByItemNameAndYearBetweenOrderByYearAscMonthAscDayAsc(
            String itemName, Integer startYear, Integer endYear);

    List<AgriPrice> findByItemNameOrderByYearAscMonthAscDayAsc(String itemName);
}