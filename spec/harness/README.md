# Test harness

`free-port.sh <port> [port ...]` stops whatever listens on a port (ARCH-02).

Planned (ARCH-03): frees ports, starts each project with its `start` script, waits for
its health endpoint, resets state between scenarios, and sets `CLINIC_NOW`. No code yet.
