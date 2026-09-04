package com.aksa.capacityplanner.unit.integration;

import com.aksa.capacityplanner.integration.security.ApiKeyAuthFilter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Sozlesme bolum 4 "Hata durumu": 401 govdesi {"error": "..."}; ve guvenlik
 * garantileri: anahtar tanimsizsa uc kapali, entegrasyon disi yollara dokunulmaz.
 */
class ApiKeyAuthFilterTest {

    private static final String KEY = "gizli-anahtar-123";

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void missingKeyOnIntegrationPathReturns401JsonAndStopsChain() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/integration/capacity");
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        new ApiKeyAuthFilter(KEY).doFilter(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(401);
        assertThat(res.getContentType()).startsWith("application/json");
        assertThat(res.getContentAsString()).contains("\"error\"");
        assertThat(chain.getRequest()).isNull(); // zincir devam ETMEDI
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void wrongKeyReturns401() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/integration/benefits");
        req.addHeader("X-API-Key", "yanlis");
        MockHttpServletResponse res = new MockHttpServletResponse();

        new ApiKeyAuthFilter(KEY).doFilter(req, res, new MockFilterChain());

        assertThat(res.getStatus()).isEqualTo(401);
    }

    @Test
    void validKeyViaHeaderOrBearerAuthenticatesAndContinues() throws Exception {
        for (String[] header : new String[][]{{"X-API-Key", KEY}, {"Authorization", "Bearer " + KEY}}) {
            SecurityContextHolder.clearContext();
            MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/integration/capacity");
            req.addHeader(header[0], header[1]);
            MockHttpServletResponse res = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();

            new ApiKeyAuthFilter(KEY).doFilter(req, res, chain);

            assertThat(res.getStatus()).isEqualTo(200);
            assertThat(chain.getRequest()).isNotNull();
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
            assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities())
                    .extracting(Object::toString).containsExactly("ROLE_INTEGRATION");
        }
    }

    @Test
    void unconfiguredKeyClosesEndpointEvenIfClientSendsSomething() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/integration/capacity");
        req.addHeader("X-API-Key", "");
        MockHttpServletResponse res = new MockHttpServletResponse();

        new ApiKeyAuthFilter("").doFilter(req, res, new MockFilterChain());

        assertThat(res.getStatus()).isEqualTo(401);
    }

    @Test
    void nonIntegrationPathsAreUntouched() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/teams");
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        new ApiKeyAuthFilter(KEY).doFilter(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(200); // filtre karar vermedi, zincire birakti
        assertThat(chain.getRequest()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }
}
