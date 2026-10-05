package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.SavedAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedAnalysisRepository extends JpaRepository<SavedAnalysis, Long> {

    List<SavedAnalysis> findByMemberIdOrderByUpdatedAtDesc(Integer memberId);

    Optional<SavedAnalysis> findByIdAndMemberId(Long id, Integer memberId);

    long countByMemberId(Integer memberId);
}
