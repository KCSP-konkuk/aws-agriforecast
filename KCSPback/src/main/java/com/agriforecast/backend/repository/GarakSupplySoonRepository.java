package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.GarakSupplySoon;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface GarakSupplySoonRepository extends JpaRepository<GarakSupplySoon, Integer> {

    List<GarakSupplySoon> findByItemNameAndSoonStartBetween(String itemName, LocalDate from, LocalDate to);

    long countByItemNameAndSoonStartBetween(String itemName, LocalDate from, LocalDate to);
}
