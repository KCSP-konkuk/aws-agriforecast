package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.AgriPrice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AgriPriceRepository extends JpaRepository<AgriPrice, Integer> {

    Optional<AgriPrice> findByItemNameAndYearAndMonthAndDay(
            String itemName, Integer year, Integer month, Integer day);

    List<AgriPrice> findByItemNameAndYearBetweenOrderByYearAscMonthAscDayAsc(
            String itemName, Integer startYear, Integer endYear);

    List<AgriPrice> findByItemNameOrderByYearAscMonthAscDayAsc(String itemName);

    // 저장된 품목명 목록 (중복 제거)
    @Query("SELECT DISTINCT a.itemName FROM AgriPrice a ORDER BY a.itemName")
    List<String> findDistinctItemNames();

    // 날짜 범위로 특정 품목 가격 조회 (year*10000+month*100+day 키 활용)
    @Query("SELECT a FROM AgriPrice a WHERE a.itemName = :itemName " +
           "AND (a.year * 10000 + a.month * 100 + a.day) BETWEEN :startKey AND :endKey " +
           "ORDER BY a.year, a.month, a.day")
    List<AgriPrice> findByItemNameAndDateRange(
            @Param("itemName") String itemName,
            @Param("startKey") int startKey,
            @Param("endKey") int endKey);
}