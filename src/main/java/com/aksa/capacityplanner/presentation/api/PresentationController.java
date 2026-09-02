package com.aksa.capacityplanner.presentation.api;

import com.aksa.capacityplanner.auth.domain.Role;
import com.aksa.capacityplanner.auth.security.JwtTokenProvider;
import com.aksa.capacityplanner.presentation.api.dto.PresentationDetailDto;
import com.aksa.capacityplanner.presentation.api.dto.PresentationDownloadRequest;
import com.aksa.capacityplanner.presentation.api.dto.PresentationSummaryDto;
import com.aksa.capacityplanner.presentation.api.dto.PresentationUpdateInPlaceRequest;
import com.aksa.capacityplanner.presentation.api.dto.PresentationUpsertRequest;
import com.aksa.capacityplanner.presentation.api.dto.PresentationVersionDetailDto;
import com.aksa.capacityplanner.presentation.api.dto.PresentationVersionDto;
import com.aksa.capacityplanner.presentation.domain.PresentationDownloadLog;
import com.aksa.capacityplanner.presentation.domain.PresentationVersion;
import com.aksa.capacityplanner.presentation.domain.SprintPresentation;
import com.aksa.capacityplanner.presentation.facade.PresentationFacade;
import jakarta.validation.Valid;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/presentations")
public class PresentationController {

    private final PresentationFacade presentationFacade;

    public PresentationController(PresentationFacade presentationFacade) {
        this.presentationFacade = presentationFacade;
    }

    @GetMapping
    public List<PresentationSummaryDto> listByTeam(@RequestParam Long teamId) {
        return presentationFacade.listByTeam(teamId).stream().map(this::toSummaryDto).toList();
    }

    @GetMapping("/{id}")
    public PresentationDetailDto getById(@PathVariable Long id) {
        return toDetailDto(presentationFacade.getById(id));
    }

    @PutMapping
    public PresentationDetailDto upsert(@Valid @RequestBody PresentationUpsertRequest request, Authentication authentication) {
        JwtTokenProvider.AccessTokenClaims claims = requireClaims(authentication);
        SprintPresentation saved = presentationFacade.upsert(request.id(), request.teamId(), request.sprintNo(), request.dateRange(),
                request.content(), claims.sicil(), claims.teamIds(), claims.role() == Role.ADMIN);
        return toDetailDto(saved);
    }

    /**
     * Ortak (coklu takim) sunum ekrani: her istenen takim icin en son sunumu
     * dondurur - bkz. PresentationFacade.listLatestPerTeam. Okuma zaten
     * herkese acik oldugundan (bkz. PresentationFacade sinif yorumu) burada
     * ek bir yetki kontrolu yapilmaz.
     */
    @GetMapping("/latest")
    public List<PresentationDetailDto> listLatestByTeams(@RequestParam List<Long> teamIds) {
        return presentationFacade.listLatestPerTeam(teamIds).stream().map(this::toDetailDto).toList();
    }

    /** Bir PPTX indirmesini (toplu/bireysel) denetim amacli kaydeder. */
    @PostMapping("/downloads")
    public void recordDownload(@Valid @RequestBody PresentationDownloadRequest request, Authentication authentication) {
        JwtTokenProvider.AccessTokenClaims claims = requireClaims(authentication);
        presentationFacade.recordDownload(PresentationDownloadLog.DownloadType.valueOf(request.downloadType()), request.teamIds(), claims.sicil());
    }

    /** "Güncelle": yeni surum eklemeden mevcut sunumu yerinde gunceller - bkz. PresentationFacade.updateInPlace. */
    @PutMapping("/{id}/content")
    public PresentationDetailDto updateInPlace(@PathVariable Long id, @Valid @RequestBody PresentationUpdateInPlaceRequest request,
                                                Authentication authentication) {
        JwtTokenProvider.AccessTokenClaims claims = requireClaims(authentication);
        SprintPresentation saved = presentationFacade.updateInPlace(id, request.dateRange(), request.content(),
                claims.sicil(), claims.teamIds(), claims.role() == Role.ADMIN);
        return toDetailDto(saved);
    }

    @GetMapping("/{id}/versions")
    public List<PresentationVersionDto> listVersions(@PathVariable Long id) {
        return presentationFacade.listVersions(id).stream().map(this::toVersionDto).toList();
    }

    /**
     * Belirli surumun TAM icerigi (content dahil). Ortak Sunum ekraninda
     * secilen surumle sunum olusturmak icin - okuma herkese acik. Rollback'in
     * aksine HICBIR SEY DEGISTIRMEZ (yeni surum eklemez, head'e dokunmaz).
     */
    @GetMapping("/{id}/versions/{version}")
    public PresentationVersionDetailDto getVersion(@PathVariable Long id, @PathVariable int version) {
        var v = presentationFacade.getVersion(id, version);
        return new PresentationVersionDetailDto(v.getVersion(), v.getContent(), v.getUpdatedBy(), v.getUpdatedAt());
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id, Authentication authentication) {
        JwtTokenProvider.AccessTokenClaims claims = requireClaims(authentication);
        presentationFacade.delete(id, claims.teamIds(), claims.role() == Role.ADMIN);
    }

    @PostMapping("/{id}/versions/{version}/rollback")
    public PresentationDetailDto rollback(@PathVariable Long id, @PathVariable int version, Authentication authentication) {
        JwtTokenProvider.AccessTokenClaims claims = requireClaims(authentication);
        SprintPresentation saved = presentationFacade.rollback(id, version, claims.sicil(), claims.teamIds(), claims.role() == Role.ADMIN);
        return toDetailDto(saved);
    }

    private JwtTokenProvider.AccessTokenClaims requireClaims(Authentication authentication) {
        if (authentication == null || !(authentication.getDetails() instanceof JwtTokenProvider.AccessTokenClaims claims)) {
            throw new AccessDeniedException("Oturum bulunamadi.");
        }
        return claims;
    }

    private PresentationSummaryDto toSummaryDto(SprintPresentation p) {
        return new PresentationSummaryDto(p.getId(), p.getTeamId(), p.getSprintNo(), p.getDateRange(),
                p.getCurrentVersion(), p.getUpdatedBy(), p.getUpdatedAt());
    }

    private PresentationDetailDto toDetailDto(SprintPresentation p) {
        return new PresentationDetailDto(p.getId(), p.getTeamId(), p.getSprintNo(), p.getDateRange(),
                p.getContent(), p.getCurrentVersion(), p.getUpdatedBy(), p.getUpdatedAt());
    }

    private PresentationVersionDto toVersionDto(PresentationVersion v) {
        return new PresentationVersionDto(v.getVersion(), v.getUpdatedBy(), v.getUpdatedAt());
    }
}
