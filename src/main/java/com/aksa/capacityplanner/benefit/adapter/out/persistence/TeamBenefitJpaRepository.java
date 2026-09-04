package com.aksa.capacityplanner.benefit.adapter.out.persistence;

import com.aksa.capacityplanner.benefit.domain.BenefitType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TeamBenefitJpaRepository extends JpaRepository<TeamBenefitJpaEntity, Long> {
    List<TeamBenefitJpaEntity> findByTeamId(Long teamId);

    Optional<TeamBenefitJpaEntity> findByTeamIdAndPeriodAndType(Long teamId, String period, BenefitType type);
}
