package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.SupplyData;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SupplyDataRepository extends JpaRepository<SupplyData, Integer> {

    Optional<SupplyData> findByItemNameAndYearAndMonthAndDay(
            String itemName, Integer year, Integer month, Integer day);

    Optional<SupplyData> findTopByOrderByYearDescMonthDescDayDesc();

    List<SupplyData> findByItemNameAndYearBetweenOrderByYearAscMonthAscDayAsc(
            String itemName, Integer startYear, Integer endYear);
}
