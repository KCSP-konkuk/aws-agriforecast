package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.RetailMarketPrice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface RetailMarketPriceRepository extends JpaRepository<RetailMarketPrice, Integer> {

    List<RetailMarketPrice> findByItemNameAndPriceDateBetween(String itemName, LocalDate startDate, LocalDate endDate);

    boolean existsByItemNameAndPriceDateBetween(String itemName, LocalDate startDate, LocalDate endDate);
}
