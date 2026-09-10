package com.aksa.capacityplanner.presentation.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;

public interface PeriodTeamOrderJpaRepository extends JpaRepository<PeriodTeamOrderJpaEntity, LocalDate> {
}
