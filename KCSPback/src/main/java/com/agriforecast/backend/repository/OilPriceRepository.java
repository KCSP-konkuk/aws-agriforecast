package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.OilPrice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface OilPriceRepository extends JpaRepository<OilPrice, Integer> {

    Optional<OilPrice> findByPriceDateAndProductName(LocalDate priceDate, String productName);

    List<OilPrice> findByProductNameAndPriceDateBetweenOrderByPriceDateAsc(
            String productName, LocalDate startDate, LocalDate endDate);

    @Query(value = "SELECT CONCAT(price_date, '_', product_name) FROM oil_price", nativeQuery = true)
    List<String> findAllDateProductKeys();
}
