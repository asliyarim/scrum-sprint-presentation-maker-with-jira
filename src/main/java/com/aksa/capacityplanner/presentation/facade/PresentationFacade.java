package com.aksa.capacityplanner.presentation.facade;

import com.aksa.capacityplanner.presentation.domain.PeriodGrouper;
import com.aksa.capacityplanner.presentation.domain.PeriodTeamOrder;
import com.aksa.capacityplanner.presentation.domain.PresentationDownloadLog;
import com.aksa.capacityplanner.presentation.domain.PresentationVersion;
import com.aksa.capacityplanner.presentation.domain.SprintPresentation;
import com.aksa.capacityplanner.presentation.port.in.PeriodOrderUseCase;
import com.aksa.capacityplanner.presentation.port.in.PresentationUseCase;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * API katmaninin dogrudan erismeden kullandigi cephe. Projede @PreAuthorize
 * kullanilmiyor (bkz. auth/security/SecurityConfig) - yetkilendirme burada,
 * cagiranin rol/takim bilgisiyle yapiliyor: okuma herkese acik (PO baska
 * takimlari salt-okunur gorebilmeli), yazma/rollback sadece admin veya
 * kendi takimi icin.
 */
@Component
public class PresentationFacade {

    private final PresentationUseCase presentationUseCase;
    private final PeriodOrderUseCase periodOrderUseCase;

    public PresentationFacade(PresentationUseCase presentationUseCase, PeriodOrderUseCase periodOrderUseCase) {
        this.presentationUseCase = presentationUseCase;
        this.periodOrderUseCase = periodOrderUseCase;
    }

    public List<SprintPresentation> listByTeam(Long teamId) {
        return presentationUseCase.listByTeamReadOnly(teamId);
    }

    public SprintPresentation getById(Long id) {
        return presentationUseCase.getByIdReadOnly(id);
    }

    public SprintPresentation upsert(Long id, Long teamId, String sprintNo, String dateRange, Map<String, Object> content,
                                      String callerSicil, List<Long> callerTeamIds, boolean callerIsAdmin) {
        requireEditAccess(teamId, callerTeamIds, callerIsAdmin);
        // id verildiyse (mevcut sunum duzenleniyor) o kaydin GERCEK takimina da
        // erisim sart - baska takimin sunumu "duzenleniyor" gibi gonderilemesin.
        if (id != null) {
            requireEditAccess(presentationUseCase.getById(id).getTeamId(), callerTeamIds, callerIsAdmin);
        }
        return presentationUseCase.upsert(id, teamId, sprintNo, dateRange, content, callerSicil);
    }

    public List<PresentationVersion> listVersions(Long presentationId) {
        return presentationUseCase.listVersions(presentationId);
    }

    /** Sunumu KALICI siler - yalnizca o takima yazma yetkisi olan (ya da admin). */
    public void delete(Long presentationId, List<Long> callerTeamIds, boolean callerIsAdmin) {
        SprintPresentation presentation = presentationUseCase.getById(presentationId);
        requireEditAccess(presentation.getTeamId(), callerTeamIds, callerIsAdmin);
        presentationUseCase.delete(presentationId);
    }

    /** Belirli surumun icerigi - okuma herkese acik (listVersions ile ayni ilke). */
    public PresentationVersion getVersion(Long presentationId, int version) {
        return presentationUseCase.getVersion(presentationId, version);
    }

    public SprintPresentation updateInPlace(Long presentationId, String dateRange, Map<String, Object> content,
                                             String callerSicil, List<Long> callerTeamIds, boolean callerIsAdmin) {
        SprintPresentation presentation = presentationUseCase.getById(presentationId);
        requireEditAccess(presentation.getTeamId(), callerTeamIds, callerIsAdmin);
        return presentationUseCase.updateInPlace(presentationId, dateRange, content, callerSicil);
    }

    public SprintPresentation rollback(Long presentationId, int version, String callerSicil, List<Long> callerTeamIds, boolean callerIsAdmin) {
        SprintPresentation presentation = presentationUseCase.getById(presentationId);
        requireEditAccess(presentation.getTeamId(), callerTeamIds, callerIsAdmin);
        return presentationUseCase.rollback(presentationId, version, callerSicil);
    }

    /**
     * Ortak (coklu takim) sunum ekrani icin: okuma zaten herkese acik (bkz.
     * sinif yorumu ustte) - PO'nun kendi takimi disindaki takimlarin en son
     * sunumunu SALT-OKUNUR gormesi burada da ayni ilkeyle kisitlanmaz.
     */
    public List<SprintPresentation> listLatestPerTeam(List<Long> teamIds) {
        return presentationUseCase.listLatestPerTeamReadOnly(teamIds);
    }

    /** Indirme kaydi herhangi bir kimlik dogrulanmis kullanici icin tutulur - takim kisitlamasi gerekmez (salt telemetri). */
    public PresentationDownloadLog recordDownload(PresentationDownloadLog.DownloadType downloadType, List<Long> teamIds, String downloadedBy) {
        return presentationUseCase.recordDownload(downloadType, teamIds, downloadedBy);
    }

    /**
     * "Sunumum hazir" isareti - ortak sunumun tetiklenmesi icin (bkz.
     * V33__presentation_finalized.sql). Yetki kurali duzenlemeyle AYNI: PO
     * kendi takiminin sunumunu isaretler, admin hepsini.
     */
    public SprintPresentation setFinalized(Long presentationId, boolean finalized, String callerSicil,
                                            List<Long> callerTeamIds, boolean callerIsAdmin) {
        SprintPresentation presentation = presentationUseCase.getById(presentationId);
        requireEditAccess(presentation.getTeamId(), callerTeamIds, callerIsAdmin);
        return presentationUseCase.setFinalized(presentationId, finalized, callerSicil);
    }

    /**
     * Donem listesi - okuma bu projede herkese acik (bkz. sinif aciklamasi),
     * ayrica donen satirlar slayt icerigi tasimaz, yalnizca takim/sprint/tarih
     * bilgisidir. Ekipler de kendi doneminde kimin hazir oldugunu gorebilmeli.
     */
    public List<PeriodGrouper.Donem> listPeriods() {
        return presentationUseCase.listPeriods();
    }

    /** Kaydedilmis donem siralamalari - okuma herkese acik (bkz. listPeriods). */
    public List<PeriodTeamOrder> listPeriodOrders() {
        return periodOrderUseCase.listOrders();
    }

    /**
     * Donemin takim sirasini yazar. Bu bir sunum icerigi degil, ortak sunumun
     * SUNUS sirasidir; herkes degistirebilir ve en son degistiren gecerlidir
     * (Gözde karari: "kim sıralama yaptıysa o şekilde sonlansın"). Bu yuzden
     * takim bazli duzenleme yetkisi ARANMAZ - zaten kimsenin sunumu
     * degismiyor. Kimin degistirdigi kayda gecer.
     */
    public PeriodTeamOrder setPeriodOrder(LocalDate periodEnd, List<Long> teamIds, String callerSicil) {
        return periodOrderUseCase.setOrder(periodEnd, teamIds, callerSicil);
    }

    private void requireEditAccess(Long targetTeamId, List<Long> callerTeamIds, boolean callerIsAdmin) {
        if (callerIsAdmin) {
            return;
        }
        if (callerTeamIds == null || !callerTeamIds.contains(targetTeamId)) {
            throw new AccessDeniedException("Bu takimin sunumlarini duzenleme yetkiniz yok.");
        }
    }
}
