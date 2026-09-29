package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.RetailPrice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface RetailPriceRepository extends JpaRepository<RetailPrice, Integer> {

    List<RetailPrice> findByItemNameAndPriceDateBetweenOrderByPriceDateAsc(
            String itemName, LocalDate startDate, LocalDate endDate);

    List<RetailPrice> findByItemNameAndPriceDateGreaterThanEqualOrderByPriceDateAsc(String itemName, LocalDate from);
}
