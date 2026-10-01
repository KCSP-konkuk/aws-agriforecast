package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.WholesaleMarketPrice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface WholesaleMarketPriceRepository extends JpaRepository<WholesaleMarketPrice, Integer> {

    List<WholesaleMarketPrice> findByItemNameAndPriceDateBetween(String itemName, LocalDate startDate, LocalDate endDate);

    boolean existsByItemNameAndPriceDateBetween(String itemName, LocalDate startDate, LocalDate endDate);
}
