package com.aksa.capacityplanner.integration.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Dis projelerin (bkz. integration/api) kullandigi SERVIS anahtari.
 *
 * Deger yalnizca INTEGRATION_API_KEY ortam degiskeninden gelir - kodda/depoda
 * varsayilan bir anahtar YOKTUR. Bos birakilirsa entegrasyon uclari tamamen
 * kapali kalir (bkz. ApiKeyAuthFilter.isValid), yani anahtar tanimlanmadan
 * hicbir veri disari acilmaz.
 */
@ConfigurationProperties(prefix = "integration")
public record IntegrationProperties(String apiKey) {
}
