package com.alertme.backend.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final FirebaseAuthenticationFilter firebaseAuthFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable()) // Stateless APIs do not use CSRF bindings
            .authorizeHttpRequests(auth -> auth
                // 1. PUBLIC ROUTES
                .requestMatchers(HttpMethod.POST, "/api/incidents").permitAll() // SOS Reporting
                .requestMatchers(HttpMethod.POST, "/api/evidence/upload/**").permitAll() // Mobile evidence submission
                .requestMatchers(HttpMethod.POST, "/api/sms/**").permitAll() // Silent SMS notifications
                .requestMatchers("/api/auth/**", "/api/citizens/register", "/api/dispatchers/register").permitAll()
                .requestMatchers("/evidence/**").permitAll() // Serving static evidence files
                .requestMatchers(HttpMethod.POST, "/api/ambulances/register").permitAll() // Let mobile units register
                
                // 2. DISPATCHER ONLY ROUTES (Command & Control)
                .requestMatchers("/api/analytics/**").hasRole("ADMIN")
                .requestMatchers("/api/authority-response/**").hasAnyRole("ADMIN", "MEDICAL", "FIRE", "POLICE")
                .requestMatchers("/api/ambulances", "/api/ambulances/**").hasAnyRole("ADMIN", "MEDICAL", "CITIZEN", "USER", "STANDARD") // Citizens need to fetch assigned ambulance location
                .requestMatchers("/api/dispatch-logs/debug-active").permitAll()
                .requestMatchers("/api/dispatch-logs/incident/**").hasAnyRole("ADMIN", "MEDICAL", "FIRE", "POLICE", "CITIZEN", "USER", "STANDARD") // Citizens need to see their own dispatch ETA
                .requestMatchers("/api/dispatch-logs/**").hasAnyRole("ADMIN", "MEDICAL", "FIRE", "POLICE", "CITIZEN", "USER", "STANDARD")
                .requestMatchers(HttpMethod.GET, "/api/hospitals", "/api/hospitals/**").hasAnyRole("ADMIN", "MEDICAL", "FIRE", "POLICE", "CITIZEN", "USER", "STANDARD")
                .requestMatchers("/api/hospitals/**").hasAnyRole("ADMIN", "MEDICAL")
                .requestMatchers(HttpMethod.GET, "/api/incidents/reporter/**").hasAnyRole("ADMIN", "MEDICAL", "FIRE", "POLICE", "CITIZEN", "USER", "STANDARD") // Let citizens see their own history
                .requestMatchers(HttpMethod.GET, "/api/incidents", "/api/incidents/**").hasAnyRole("ADMIN", "MEDICAL", "FIRE", "POLICE") // Privacy: Only Dispatchers see the full list
                .requestMatchers(HttpMethod.POST, "/api/incidents/*/dispatch").hasAnyRole("ADMIN", "MEDICAL")
                .requestMatchers(HttpMethod.POST, "/api/incidents/*/authority-response/initialize").hasAnyRole("ADMIN", "MEDICAL", "FIRE", "POLICE") // All roles can trigger auto-init
                .requestMatchers(HttpMethod.PATCH, "/api/incidents/**").hasAnyRole("ADMIN", "MEDICAL", "FIRE", "POLICE") // Status and complete management
                
                // 3. PROTECTED MEDICAL DATA
                .requestMatchers(HttpMethod.GET, "/api/medical-profiles/**").hasAnyRole("ADMIN", "MEDICAL", "CITIZEN", "USER", "STANDARD") // Allow users to sync their own profile
                .requestMatchers(HttpMethod.POST, "/api/medical-profiles/**").hasAnyRole("ADMIN", "MEDICAL", "CITIZEN", "USER", "STANDARD")
                .requestMatchers(HttpMethod.PUT, "/api/medical-profiles/**").hasAnyRole("ADMIN", "MEDICAL", "CITIZEN", "USER", "STANDARD")
                
                // 4. INFRASTRUCTURE & DOCUMENTATION
                .requestMatchers(
                        "/api/test",
                        "/api/admin/**",
                        "/v3/api-docs",
                        "/v3/api-docs/**",
                        "/swagger-ui/**",
                        "/swagger-ui.html",
                        "/swagger-resources",
                        "/swagger-resources/**",
                        "/configuration/ui",
                        "/configuration/security",
                        "/webjars/**"
                ).permitAll()
                
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .addFilterBefore(firebaseAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // Allow all origins since mobile apps and different devices connect from varying IPs
        configuration.setAllowedOriginPatterns(List.of("*"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
