package com.aksa.capacityplanner.auth.security;

import com.aksa.capacityplanner.integration.config.IntegrationProperties;
import com.aksa.capacityplanner.integration.security.ApiKeyAuthFilter;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.http.HttpStatus;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@EnableConfigurationProperties({JwtProperties.class, IntegrationProperties.class})
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtTokenProvider jwtTokenProvider,
                                                    IntegrationProperties integrationProperties) throws Exception {
        http
                .csrf(csrf -> csrf.disable()) // Spring'in yerlesik CSRF'i yerine CsrfCookieFilter (double-submit) kullaniliyor
                .cors(cors -> {})
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(auth -> auth
                        // /api/auth/** artik bu serviste yok: Odyssey o yolu
                        // odyssey-auth servisine proxy'liyor (bkz. Odyssey nginx.conf).
                        //
                        // Entegrasyon ucu SADECE servis anahtariyla (ROLE_INTEGRATION,
                        // bkz. ApiKeyAuthFilter) erisilebilir - tarayicidan giris yapmis
                        // bir kullanicinin cookie'si bu yolu ACMAZ, boylece "tum
                        // takimlarin kapasitesi" yuzeyi UI kullanicilarina genislemez.
                        .requestMatchers("/api/integration/**").hasRole("INTEGRATION")
                        .anyRequest().authenticated())
                // Servis anahtarli entegrasyon ucu (/api/integration/**) - cookie
                // tasiyamayan dis projeler icin. Anahtar gecerliyse authentication
                // yazar, degilse hicbir sey yapmaz ve istek anyRequest().authenticated()
                // kuralina takilip 401 doner (yeni bir permitAll yolu ACILMAZ).
                .addFilterBefore(new ApiKeyAuthFilter(integrationProperties.apiKey()),
                        UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(new JwtCookieAuthFilter(jwtTokenProvider), UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(new CsrfCookieFilter(), JwtCookieAuthFilter.class);

        return http.build();
    }
}
