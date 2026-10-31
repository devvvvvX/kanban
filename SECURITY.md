# Security Policy

## Our Security Posture

**Kanban is 100% offline-first by default.**
- **Zero Telemetry**: We do not collect, transmit, or store any analytics, error logs, or personal identifiable information on remote servers.
- **Zero Cloud Lock-in**: Your projects, tickets, epics, notes, and credentials live entirely in local SQLite databases on your Mac.
- **Strict Multi-Account Cryptographic Isolation**:
  - Passwords are encrypted using state-of-the-art **Argon2id** (`m=65536, t=3, p=4`) with per-user cryptographic salts and client-side rate limiting.
  - Offline account recovery is powered by **256-bit high-entropy recovery phrases**, allowing password reset without any external identity provider.
  - Multi-tenant data segregation is strictly enforced via `user_id` foreign keys and database transactions.

---

## Supported Versions

We provide security updates and patches for the current major release:

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability in Kanban, please do **not** disclose it in a public GitHub issue.

Instead, please report the vulnerability privately to the project maintainers:
- **GitHub Security Advisory**: Open a private draft security advisory at [https://github.com/devvvvvX/kanban/security/advisories](https://github.com/devvvvvX/kanban/security/advisories)
- **Direct Contact**: Reach out via GitHub: [@devvvvvX](https://github.com/devvvvvX)

Please include:
1. A clear description of the vulnerability.
2. Step-by-step instructions or proof-of-concept scripts to reproduce the issue.
3. The potential impact on local data integrity or account isolation.

We will acknowledge receipt within 48 hours and work with you to patch and disclose the issue responsibly.

