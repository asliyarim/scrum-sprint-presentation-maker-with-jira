package com.aksa.capacityplanner.presentation.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SprintPresentationReadOnlyJpaRepository extends JpaRepository<SprintPresentationReadOnlyJpaEntity, Long> {
    Optional<SprintPresentationReadOnlyJpaEntity> findById(Long id);

    List<SprintPresentationReadOnlyJpaEntity> findByTeamId(Long teamId);

    List<SprintPresentationReadOnlyJpaEntity> findByTeamIdIn(List<Long> teamIds);

    /**
     * Donem gruplamasi icin HAFIF satirlar - `content` (slaytlarin tamami)
     * bilerek okunmaz. Bu sorgu TUM takimlarin TUM sunumlarini tarar ve her
     * sprintte 8 kayit daha eklenir; tam entity cekmek ekrani zamanla
     * agirlastirirdi. Donem tarihi olmayan (eski, cevrilemeyen) kayitlar
     * bastan elenir - onlar hicbir doneme giremez.
     */
    @Query("select p.id as id, p.teamId as teamId, p.sprintNo as sprintNo, p.dateRange as dateRange, "
            + "p.currentVersion as currentVersion, p.updatedBy as updatedBy, p.updatedAt as updatedAt, "
            + "p.finalizedAt as finalizedAt, p.finalizedBy as finalizedBy, "
            + "p.periodStart as periodStart, p.periodEnd as periodEnd "
            + "from SprintPresentationReadOnlyJpaEntity p where p.periodEnd is not null")
    List<PeriodRow> findPeriodRows();

    /** Yalnizca donem ekraninin ihtiyaci olan alanlar (bkz. findPeriodRows). */
    interface PeriodRow {
        Long getId();

        Long getTeamId();

        String getSprintNo();

        String getDateRange();

        int getCurrentVersion();

        String getUpdatedBy();

        Instant getUpdatedAt();

        Instant getFinalizedAt();

        String getFinalizedBy();

        LocalDate getPeriodStart();

        LocalDate getPeriodEnd();
    }
}
