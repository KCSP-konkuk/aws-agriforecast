package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.CommunityVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CommunityVoteRepository extends JpaRepository<CommunityVote, Long> {

    Optional<CommunityVote> findByItemNameAndTargetSoonAndMemberId(String itemName, String targetSoon, Integer memberId);

    /** [choice, count] */
    @Query("SELECT v.choice, COUNT(v) FROM CommunityVote v WHERE v.itemName = :itemName AND v.targetSoon = :targetSoon GROUP BY v.choice")
    List<Object[]> countByChoice(@Param("itemName") String itemName, @Param("targetSoon") String targetSoon);
}
