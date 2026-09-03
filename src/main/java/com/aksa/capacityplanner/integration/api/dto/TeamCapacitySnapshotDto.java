package com.aksa.capacityplanner.integration.api.dto;

import java.time.Instant;
import java.util.List;

/**
 * Bir takimin EN SON KAYDEDILEN sunumundaki kapasite verisi.
 *
 * Kapasite, dashboard akisinda kalici olarak yalnizca sunum kaydedilirken
 * (content.dashData) saklanir - bu yuzden kaynak "son kayit"tir (mutabakat:
 * Nezih, 2026-09-03: "son kayit yeterli").
 *
 * lastUpdated: o sunumun son kaydedilme zamani. Cagiran taraf veri
 * guncelligini bununla takip eder (Nezih istegi: "guncelleme tarihi koy api
 * icine ben yakalarim veri guncelligini").
 *
 * Hic sunum kaydetmemis takimlar da listede DONER - totals null, members bos
 * gelir; boylece cagiran taraf "veri yok" ile "sifir kapasite"yi ayirt eder.
 */
public record TeamCapacitySnapshotDto(Long teamId, String teamName, String sprintNo, String dateRange,
                                        String reportDate, Instant lastUpdated, Integer version,
                                        CapacityTotalsDto totals, List<MemberCapacitySnapshotDto> members) {
}
