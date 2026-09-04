package com.aksa.capacityplanner.integration.api.dto;

import java.time.Instant;
import java.util.List;

/**
 * Bir takimin EN SON girilen donemine ait kazanim sayilari (bolum 3.2).
 * Listede yalnizca kazanim tutan takimlar (simdilik RPA) yer alir - bkz.
 * BenefitsSnapshotService.isBenefitTeam. Hic kayit yoksa period/lastUpdated
 * null ve benefits bos liste doner.
 */
public record TeamBenefitsSnapshotDto(int apiVersion, String projectKey, Long teamId, String teamName,
                                      String period, Instant lastUpdated, List<BenefitEntryDto> benefits) {
}
