package com.aksa.capacityplanner.presentation.api;

import com.aksa.capacityplanner.auth.domain.Role;
import com.aksa.capacityplanner.auth.security.JwtTokenProvider;
import com.aksa.capacityplanner.presentation.api.dto.JointPresentationDto;
import com.aksa.capacityplanner.presentation.domain.JointPresentation;
import com.aksa.capacityplanner.presentation.facade.JointPresentationFacade;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Kaydedilmis ORTAK (coklu takim) sunumlar - admin panelinde tarih tarih
 * listelenir ve tekrar indirilebilir (Cagdas Bey istegi, 2026-09-07).
 */
@RestController
@RequestMapping("/api/joint-presentations")
public class JointPresentationController {

    private final JointPresentationFacade jointPresentationFacade;

    public JointPresentationController(JointPresentationFacade jointPresentationFacade) {
        this.jointPresentationFacade = jointPresentationFacade;
    }

    @GetMapping
    public List<JointPresentationDto> list() {
        return jointPresentationFacade.listNewestFirst().stream().map(this::toDto).toList();
    }

    @GetMapping("/{id}")
    public JointPresentationDto getById(@PathVariable Long id) {
        return toDto(jointPresentationFacade.getById(id));
    }

    @PostMapping
    public JointPresentationDto create(@Valid @RequestBody CreateRequest request, Authentication authentication) {
        JwtTokenProvider.AccessTokenClaims claims = requireClaims(authentication);
        return toDto(jointPresentationFacade.create(request.title(), request.picks(), claims.sicil()));
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id, Authentication authentication) {
        JwtTokenProvider.AccessTokenClaims claims = requireClaims(authentication);
        jointPresentationFacade.delete(id, claims.sicil(), claims.role() == Role.ADMIN);
    }

    public record CreateRequest(String title, @NotNull List<Map<String, Object>> picks) {
    }

    private JwtTokenProvider.AccessTokenClaims requireClaims(Authentication authentication) {
        if (authentication == null || !(authentication.getDetails() instanceof JwtTokenProvider.AccessTokenClaims claims)) {
            throw new AccessDeniedException("Oturum bulunamadi.");
        }
        return claims;
    }

    private JointPresentationDto toDto(JointPresentation j) {
        return new JointPresentationDto(j.getId(), j.getTitle(), j.getPicks(), j.getCreatedBy(), j.getCreatedAt());
    }
}
