package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.RealItemPrice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface RealItemPriceRepository extends JpaRepository<RealItemPrice, Integer> {
    
    // 특정 품목, 기간, 등급으로 가격 조회
    @Query("SELECT r FROM RealItemPrice r WHERE r.itemCode.seqNoA021 = :itemCode " +
           "AND r.priceDate BETWEEN :startDate AND :endDate " +
           "AND (:grade IS NULL OR r.grade = :grade) " +
           "ORDER BY r.priceDate ASC")
    List<RealItemPrice> findByItemCodeAndDateRange(
        @Param("itemCode") Integer itemCode,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate,
        @Param("grade") String grade
    );
    
    // 특정 품목의 모든 등급 목록 조회
    @Query("SELECT DISTINCT r.grade FROM RealItemPrice r WHERE r.itemCode.seqNoA021 = :itemCode AND r.grade IS NOT NULL ORDER BY r.grade")
    List<String> findDistinctGradesByItemCode(@Param("itemCode") Integer itemCode);
    
    // 특정 품목, 카테고리의 모든 등급 목록 조회
    @Query("SELECT DISTINCT r.grade FROM RealItemPrice r " +
           "WHERE r.itemCode.seqNoA021 = :itemCode AND r.itemCode.category = :category " +
           "AND r.grade IS NOT NULL ORDER BY r.grade")
    List<String> findDistinctGradesByItemCodeAndCategory(
        @Param("itemCode") Integer itemCode,
        @Param("category") Integer category
    );
}

