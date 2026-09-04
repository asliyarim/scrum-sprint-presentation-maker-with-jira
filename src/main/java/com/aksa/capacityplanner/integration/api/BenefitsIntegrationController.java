package com.aksa.capacityplanner.integration.api;

import com.aksa.capacityplanner.integration.api.dto.TeamBenefitsSnapshotDto;
import com.aksa.capacityplanner.integration.usecase.BenefitsSnapshotService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Dis dashboard icin SALT-OKUNUR "zaman disi kazanimlar" ucu (gereksinim
 * dokumani 04.09.2026, bolum 3). Kapasite ucuyla ayni kimlik dogrulama
 * (ApiKeyAuthFilter) ve ayni temel adres.
 */
@RestController
@RequestMapping("/api/integration/benefits")
public class BenefitsIntegrationController {

    private final BenefitsSnapshotService benefitsSnapshotService;

    public BenefitsIntegrationController(BenefitsSnapshotService benefitsSnapshotService) {
        this.benefitsSnapshotService = benefitsSnapshotService;
    }

    @GetMapping
    public List<TeamBenefitsSnapshotDto> listAll() {
        return benefitsSnapshotService.listAll();
    }
}
