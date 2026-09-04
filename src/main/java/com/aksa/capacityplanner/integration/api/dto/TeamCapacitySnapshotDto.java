package com.aksa.capacityplanner.integration.api.dto;

import java.time.Instant;
import java.util.List;

/**
 * Bir takimin EN SON KAYDEDILEN sunumundaki kapasite verisi (dis dashboard
 * sozlesmesi - Nezih, gereksinim dokumani 04.09.2026, bolum 2 ve 4).
 *
 * apiVersion          : SOZLESME surumu. Alan adi degisikligi/kaldirma bunu
 *                       artirir (bolum 4 "Degisiklik yonetimi"). Sunumun kendi
 *                       surumu ayri alandadir (presentationVersion) - eskiden
 *                       "version" adiyla veriliyordu ve sozlesme surumuyle
 *                       karistiriliyordu.
 * projectKey          : Jira proje anahtari (K1) - dashboard takimi bununla baglar.
 * unit                : efor/kapasite alanlarinin birimi (K3) - her zaman "day".
 * sprintNo/dateRange  : sunumun kendi sprinti ve tarih araligi.
 * capacityPeriod      : KAPASITE HESABININ PENCERESI (orn. "01 Haziran – 31
 *                       Aralık 2026"). Bolum 2.2'deki "10 is gunluk sprintte
 *                       94 gun kapasite olamaz" sorusunun cevabi: kapasite
 *                       sprintin degil, rapor tarihinden donem sonuna kalan
 *                       is gunudur; efor da donem basindan beri birikmistir.
 * lastUpdated         : sunumun son kaydedilme zamani (veri guncelligi).
 *
 * Hic sunum kaydetmemis takimlar da DONER - totals null, members bos.
 */
public record TeamCapacitySnapshotDto(int apiVersion, Long teamId, String teamName, String projectKey,
                                        String unit, String sprintNo, String dateRange,
                                        String capacityPeriod, String reportDate,
                                        Instant lastUpdated, Integer presentationVersion,
                                        CapacityTotalsDto totals, List<MemberCapacitySnapshotDto> members) {
}
