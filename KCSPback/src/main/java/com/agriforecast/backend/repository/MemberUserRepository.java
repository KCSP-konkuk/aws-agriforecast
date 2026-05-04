package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.MemberUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MemberUserRepository extends JpaRepository<MemberUser, Integer> {
    
    // 아이디(ID 필드)로 사용자 찾기
    // 주의: JPA의 findById는 기본키(Integer seqNoA010)로 찾는 메서드이므로,
    // 아이디 필드(String id)로 찾으려면 @Query 사용
    @Query("SELECT u FROM MemberUser u WHERE u.id = :userId")
    Optional<MemberUser> findByUserId(@Param("userId") String userId);
    
    // 아이디 존재 여부 확인
    @Query("SELECT COUNT(u) > 0 FROM MemberUser u WHERE u.id = :userId")
    boolean existsByUserId(@Param("userId") String userId);
}

