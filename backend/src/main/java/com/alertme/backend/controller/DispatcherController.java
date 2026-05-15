package com.alertme.backend.controller;

import com.alertme.backend.model.Dispatcher;
import com.alertme.backend.service.DispatcherService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dispatchers")
@RequiredArgsConstructor
public class DispatcherController {

    private final DispatcherService dispatcherService;

    @PostMapping("/register")
    public ResponseEntity<Dispatcher> registerDispatcher(@RequestBody Dispatcher dispatcher) {
        return new ResponseEntity<>(dispatcherService.registerDispatcher(dispatcher), HttpStatus.CREATED);
    }

    @GetMapping("/phone/{phoneNumber}")
    public ResponseEntity<Dispatcher> getDispatcherByPhone(@PathVariable String phoneNumber) {
        return dispatcherService.findByPhoneNumber(phoneNumber)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<Dispatcher>> getAllDispatchers() {
        return ResponseEntity.ok(dispatcherService.getAllDispatchers());
    }
}
