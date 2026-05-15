package com.alertme.backend.controller;

import com.alertme.backend.model.Evidence;
import com.alertme.backend.service.EvidenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/evidence")
@RequiredArgsConstructor
public class EvidenceController {

    private final EvidenceService evidenceService;

    @Value("${alertme.upload.dir:uploads/evidence}")
    private String uploadDir;

    @Value("${alertme.server.base-url:http://localhost:8080}")
    private String serverBaseUrl;

    // ── Existing JSON Upload (keeps backward compatibility) ──
    @PostMapping("/upload")
    public ResponseEntity<Evidence> uploadEvidence(@RequestBody Evidence evidence) {
        return new ResponseEntity<>(evidenceService.uploadEvidence(evidence), HttpStatus.CREATED);
    }

    @PostMapping("/upload/file")
    public ResponseEntity<?> uploadEvidenceFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("incidentId") String incidentId,
            @RequestParam("mediaType") String mediaType,
            jakarta.servlet.http.HttpServletRequest request
    ) {
        try {
            // Generate unique filename preserving extension
            String originalName = file.getOriginalFilename();
            String extension = (originalName != null && originalName.contains("."))
                    ? originalName.substring(originalName.lastIndexOf('.'))
                    : "";
            String savedFileName = UUID.randomUUID().toString() + extension;
            
            // Save locally to bypass Firebase Storage limits
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
            Path filePath = uploadPath.resolve(savedFileName);
            Files.copy(file.getInputStream(), filePath);

            // Build a publicly accessible local URL dynamically from the request
            String requestUrl = request.getRequestURL().toString();
            String baseUrl = requestUrl.substring(0, requestUrl.indexOf("/api/evidence/upload"));
            String publicUrl = baseUrl + "/evidence/" + savedFileName;

            // Persist the Evidence record pointing to the newly generated local URL
            Evidence evidence = new Evidence();
            evidence.setMediaType(mediaType.toUpperCase());
            evidence.setStorageUrl(publicUrl);
            evidence.setTacticalLiveFeed(false);

            // Resolve incident via service (uses IncidentRepository internally)
            Evidence saved = evidenceService.uploadEvidenceForIncident(incidentId, evidence);
            return new ResponseEntity<>(saved, HttpStatus.CREATED);

        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Local file upload failed: " + e.getMessage()));
        }
    }

    @GetMapping("/incident/{incidentId}")
    public ResponseEntity<List<Evidence>> getEvidenceByIncident(@PathVariable String incidentId) {
        return ResponseEntity.ok(evidenceService.getEvidenceForIncident(incidentId));
    }

    @GetMapping("/{evidenceId}")
    public ResponseEntity<Evidence> getEvidenceById(@PathVariable String evidenceId) {
        return evidenceService.getEvidenceById(evidenceId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{evidenceId}")
    public ResponseEntity<Void> deleteEvidence(@PathVariable String evidenceId) {
        evidenceService.deleteEvidence(evidenceId);
        return ResponseEntity.noContent().build();
    }
}
