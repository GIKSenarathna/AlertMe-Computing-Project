package com.alertme.backend.service;

import com.alertme.backend.model.Dispatcher;
import com.alertme.backend.repository.DispatcherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DispatcherService {

    private final DispatcherRepository dispatcherRepository;

    public Dispatcher registerDispatcher(Dispatcher dispatcher) {
        return dispatcherRepository.save(dispatcher);
    }

    public Optional<Dispatcher> findByPhoneNumber(String phoneNumber) {
        return dispatcherRepository.findByPhoneNumber(phoneNumber);
    }
    
    public List<Dispatcher> getAllDispatchers() {
        return dispatcherRepository.findAll();
    }
}
