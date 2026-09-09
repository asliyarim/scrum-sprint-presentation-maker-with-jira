package com.aksa.capacityplanner.presentation.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SprintPresentationJpaRepository extends JpaRepository<SprintPresentationJpaEntity, Long> {
    Optional<SprintPresentationJpaEntity> findByTeamIdAndSprintNo(Long teamId, String sprintNo);

    List<SprintPresentationJpaEntity> findByTeamId(Long teamId);

    /** Donem tarihi henuz doldurulmamis kayitlar - bkz. PresentationPeriodBackfill. */
    List<SprintPresentationJpaEntity> findByPeriodStartIsNull();
}
