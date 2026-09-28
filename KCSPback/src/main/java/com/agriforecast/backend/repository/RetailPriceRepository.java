package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.RetailPrice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RetailPriceRepository extends JpaRepository<RetailPrice, Integer> {

    Optional<RetailPrice> findByItemNameAndPriceDate(String itemName, LocalDate priceDate);

    List<RetailPrice> findByItemNameAndPriceDateBetweenOrderByPriceDateAsc(
            String itemName, LocalDate startDate, LocalDate endDate);

    List<RetailPrice> findByItemNameOrderByPriceDateAsc(String itemName);
}
