package com.alertme.backend.security;

import com.alertme.backend.repository.DispatcherRepository;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class FirebaseAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(FirebaseAuthenticationFilter.class);

    private final DispatcherRepository dispatcherRepository;

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        // Skip this filter for all public auth endpoints — they handle their own token
        // verification
        String path = request.getServletPath();
        return path.startsWith("/api/auth/");
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");
        log.debug("Incoming request: {} {} | Auth header present: {}",
                request.getMethod(), request.getServletPath(), authHeader != null);

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.debug("No Bearer token — passing to Spring Security as anonymous. Path={} {}",
                    request.getMethod(), request.getServletPath());
            filterChain.doFilter(request, response);
            return;
        }

        String idToken = authHeader.substring(7);
        try {
            // Verify the Firebase ID Token
            FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(idToken);
            String uid = decodedToken.getUid();
            String phoneNumber = (String) decodedToken.getClaims().get("phone_number");

            if (phoneNumber == null) {
                // If it's an email login, Firebase puts email in the token
                phoneNumber = decodedToken.getEmail();
            }

            if (phoneNumber != null && SecurityContextHolder.getContext().getAuthentication() == null) {

                // Determine Role: Check phone number OR email (email/password Firebase login
                // uses email as identifier)
                java.util.Optional<com.alertme.backend.model.Dispatcher> dOpt = dispatcherRepository
                        .findByPhoneNumber(phoneNumber);
                if (dOpt.isEmpty()) {
                    dOpt = dispatcherRepository.findByEmail(phoneNumber);
                }
                String role = dOpt.isPresent() ? dOpt.get().getAccessLevel() : "CITIZEN";

                UserDetails userDetails = User.builder()
                        .username(phoneNumber)
                        .password("")
                        .authorities(List.of(new SimpleGrantedAuthority("ROLE_" + role)))
                        .build();

                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());

                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                // Spring Security 6: must create a new context and call setContext() explicitly
                // Using getContext().setAuthentication() is NOT enough — AnonymousAuthenticationFilter will overwrite it
                org.springframework.security.core.context.SecurityContext securityContext =
                        SecurityContextHolder.createEmptyContext();
                securityContext.setAuthentication(authToken);
                SecurityContextHolder.setContext(securityContext);
                log.info("Firebase auth success: user={} role=ROLE_{} path={} {}",
                        phoneNumber, role, request.getMethod(), request.getServletPath());
            } else {
                log.warn("Firebase auth warning: phoneNumber/UID was null or SecurityContext already populated. Path={} {}",
                        request.getMethod(), request.getServletPath());
            }
        } catch (Exception e) {
            // Token is invalid or expired
            log.warn("Firebase auth failed: {} | Path={} {}", e.getMessage(),
                    request.getMethod(), request.getServletPath());
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("Invalid Firebase Token: " + e.getMessage());
            return;
        }

        filterChain.doFilter(request, response);
    }
}

