package com.aksa.capacityplanner.integration.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/**
 * /api/integration/** yollarini SERVIS ANAHTARIYLA (kullanici oturumu olmadan)
 * dogrular. Kapasite verisini baska bir projede kullanacak ekip tarayici
 * cookie'si tasiyamadigi icin bu yol acildi (talep: Nezih, 2026-09-03).
 *
 * Anahtar dogruysa SecurityContext'e ROLE_INTEGRATION yazilir. Yanlis/eksikse
 * HICBIR SEY yazilmaz; SecurityConfig'teki anyRequest().authenticated() kurali
 * istegi 401 ile reddeder. Boylece yeni bir permitAll yolu ACILMAZ ve mevcut
 * cookie tabanli akis (JwtCookieAuthFilter) hic etkilenmez.
 */
public class ApiKeyAuthFilter extends OncePerRequestFilter {

    public static final String PATH_PREFIX = "/api/integration/";
    private static final String API_KEY_HEADER = "X-API-Key";
    private static final String BEARER_PREFIX = "Bearer ";

    private final String configuredKey;

    public ApiKeyAuthFilter(String configuredKey) {
        this.configuredKey = configuredKey;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (request.getRequestURI().startsWith(PATH_PREFIX) && isValid(presentedKey(request))) {
            var authentication = new UsernamePasswordAuthenticationToken(
                    "integration", null, List.of(new SimpleGrantedAuthority("ROLE_INTEGRATION")));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }
        filterChain.doFilter(request, response);
    }

    /** Anahtar "X-API-Key" ya da "Authorization: Bearer &lt;anahtar&gt;" ile gonderilebilir. */
    private String presentedKey(HttpServletRequest request) {
        String header = request.getHeader(API_KEY_HEADER);
        if (header != null && !header.isBlank()) {
            return header.trim();
        }
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith(BEARER_PREFIX)) {
            return authorization.substring(BEARER_PREFIX.length()).trim();
        }
        return null;
    }

    /**
     * Anahtar tanimli degilse uc TAMAMEN KAPALIDIR (yanlislikla acik kalmasin).
     * Karsilastirma, uzunluk/icerik sizdirmamak icin zaman-sabittir.
     */
    private boolean isValid(String presented) {
        if (configuredKey == null || configuredKey.isBlank() || presented == null) {
            return false;
        }
        return MessageDigest.isEqual(configuredKey.getBytes(StandardCharsets.UTF_8),
                presented.getBytes(StandardCharsets.UTF_8));
    }
}
