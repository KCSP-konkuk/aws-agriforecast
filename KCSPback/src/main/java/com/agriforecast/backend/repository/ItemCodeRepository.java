package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.ItemCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ItemCodeRepository extends JpaRepository<ItemCode, Integer> {
    
    // 카테고리별 품목 조회
    List<ItemCode> findByCategory(Integer category);
    
    // 모든 품목 조회 (정렬)
    List<ItemCode> findAllByOrderByItemNameAsc();
}

