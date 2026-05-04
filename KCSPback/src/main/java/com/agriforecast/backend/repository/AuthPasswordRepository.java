package com.agriforecast.backend.repository;

import com.agriforecast.backend.entity.AuthPassword;
import com.agriforecast.backend.entity.MemberUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AuthPasswordRepository extends JpaRepository<AuthPassword, Integer> {
    
    // 사용자로 비밀번호 정보 찾기
    Optional<AuthPassword> findByMemberUser(MemberUser memberUser);
}







