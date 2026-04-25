# AGENTS.md — Codex Security Instructions

## Purpose

This repository must be implemented and modified with security-first defaults.

Codex must follow these instructions for all tasks in this repository unless the user explicitly states that a specific control is out of scope.

The security baseline is aligned to the OWASP Top 10:2025 control areas provided below.

## Non-Negotiable Rules

- Do not claim any security protection unless it exists in the actual code and is wired into the running application.
- Do not fake functionality, fake packages, fake middleware, fake database behavior, or fake tests.
- Do not weaken authentication, authorization, validation, session handling, logging, crypto, dependency safety, or deployment safety without explicit approval.
- Do not rely on hidden UI elements, client-side checks, obscured IDs, or comments as security controls.
- Prefer small, readable, auditable changes.
- Treat all user input, route parameters, request bodies, cookies, headers, files, database records, third-party responses, and AI/model outputs as untrusted.
- Never print, log, commit, or expose secrets.
- If a requested feature conflicts with these requirements, explain the conflict and choose the safer implementation.

## Required End-of-Build Report

At the end of every implementation or security-relevant modification, provide a control-by-control status report.

Allowed statuses:

- Implemented
- Partially Implemented
- Not Implemented

The report must be evidence-based. If the control is only partly present, mark it as `Partially Implemented`. If it is missing, mark it as `Not Implemented`.

Do not mark a control as `Implemented` unless the code actually provides the protection and it is connected to the running app.

---

# Security Requirements

## A01: Broken Access Control

### Required Controls

- Server-side authorization must be enforced on all protected routes and actions.
- Users must not be able to access or modify other users’ data without explicit authorization.
- Admin functionality must require server-side admin checks.
- Hidden UI elements alone must never be treated as access control.
- Object identifiers must not allow insecure direct object reference behavior.
- Sensitive create, update, delete, and admin actions must be protected by access checks.

### Implementation Rules

- Protect routes server-side, not only in the UI.
- Check resource ownership before reading, updating, or deleting user-owned records.
- Check role or permission server-side before admin actions.
- Do not expose cross-user records through predictable IDs.
- Use middleware or explicit checks consistently.

### Evidence to Provide

- Access-control middleware used:
- Admin-only routes:
- Per-resource ownership checks:
- Known limitations:

---

## A02: Security Misconfiguration

### Required Controls

- Production configuration must disable debug behavior and verbose error output.
- Security headers should be applied where appropriate.
- Default credentials must not exist in production configuration.
- Cookies and session settings must be explicitly configured.
- Unnecessary routes, features, or services should not be exposed.
- Environment-specific configuration must be supported safely.

### Implementation Rules

- Use production-safe settings when `NODE_ENV=production`, `FLASK_ENV=production`, `DJANGO_DEBUG=False`, or the relevant stack equivalent.
- Do not expose stack traces to users in production.
- Configure cookies explicitly.
- Add security headers where supported by the stack.
- Avoid exposing dev-only routes, debug panels, test accounts, admin consoles, or seed endpoints in production.

### Evidence to Provide

- Security headers used:
- Production-safe cookie settings:
- Debug-disabled behavior:
- Known limitations:

---

## A03: Software Supply Chain Failures

### Required Controls

- Only real, necessary packages may be added.
- New dependencies must be identified and justified.
- Unmaintained or unnecessary packages should be avoided.
- Install and run instructions must reflect the actual dependency set.
- Build scripts must not fetch or execute arbitrary remote code without justification.
- External components and libraries must be visible in the project manifest.

### Implementation Rules

- Prefer the standard library and existing project dependencies.
- Do not invent package names.
- Do not add dependencies for trivial helpers.
- Do not add abandoned or obscure packages without justification.
- Do not use `curl | sh`, `wget | bash`, or equivalent remote-code execution patterns unless explicitly approved and justified.
- Keep dependency manifests accurate.

### Evidence to Provide

- Dependency list reviewed:
- New packages added and why:
- Supply-chain limitations:
- Known limitations:

---

## A04: Cryptographic Failures

### Required Controls

- Passwords must be hashed using a suitable password-hashing function.
- Plaintext passwords must never be stored.
- Sensitive secrets must not be hardcoded as production values.
- Session secrets must come from configuration in production.
- Sensitive data must not be exposed in logs, URLs, or error messages.
- If encryption is claimed, specify exactly what is encrypted and how.

### Implementation Rules

- Use accepted password hashing such as Argon2, bcrypt, scrypt, or the framework’s recommended password hasher.
- Never store plaintext passwords.
- Never use MD5, SHA1, or unsalted fast hashes for passwords.
- Use environment variables or secure configuration for production secrets.
- Do not log secrets, passwords, tokens, session IDs, or authorization headers.
- Do not claim encryption unless encryption is actually implemented.

### Evidence to Provide

- Password hashing method:
- Secret/config handling:
- Sensitive data protections:
- Known limitations:

---

## A05: Injection

### Required Controls

- Database queries must use parameterized queries or equivalent safe patterns.
- User input must never be concatenated directly into SQL queries.
- Commands, file paths, and template behavior must not be built unsafely from user input.
- Server-side input validation must exist for all important inputs.
- Type checks and length limits must be enforced before processing.

### Implementation Rules

- Use ORM query builders, prepared statements, or parameterized queries.
- Validate important inputs server-side.
- Apply type checks, length limits, and format checks before processing.
- Avoid shelling out with user-controlled values.
- If shell execution is unavoidable, use argument arrays and strict allowlists.
- Sanitize file paths and prevent path traversal.
- Avoid unsafe template rendering with user-controlled templates.

### Evidence to Provide

- Query safety pattern:
- Validation approach:
- Inputs with strict validation:
- Known limitations:

---

## A06: Insecure Design

### Required Controls

- The app must define authentication, authorization, and trust boundaries before implementation.
- Sensitive workflows must have explicit abuse-case thinking.
- Risky actions should require the correct privilege level.
- Features must not rely on client-side checks as a security control.
- The route list, page list, and schema should reflect deliberate security design choices.

### Implementation Rules

- Identify protected routes before implementing them.
- Identify public routes before implementing them.
- Define which users can access which records.
- Document assumptions for roles, ownership, sessions, and data flow.
- Consider abuse cases for login, signup, admin actions, data export, file upload, payments, destructive actions, and LLM/tool use where relevant.

### Evidence to Provide

- Security-sensitive workflows identified:
- Abuse cases considered:
- Design assumptions:
- Known limitations:

---

## A07: Authentication Failures

### Required Controls

- Authentication must be session-based if sessions are part of the stack requirement.
- Login must verify credentials securely against stored password hashes.
- Sessions should be regenerated or invalidated appropriately on login.
- Logout must destroy the session.
- Session cookies must be HttpOnly.
- Session cookies should use SameSite protections.
- Secure cookies must be enabled in production.
- Authentication-required actions must be protected server-side.

### Implementation Rules

- Verify credentials using the password hasher’s verify function.
- Do not compare plaintext passwords.
- Regenerate or rotate sessions after login where supported.
- Destroy or invalidate sessions on logout.
- Configure cookies explicitly:
  - `HttpOnly`
  - `SameSite=Lax` or stricter where appropriate
  - `Secure=true` in production
- Protect authenticated actions with server-side middleware or checks.

### Evidence to Provide

- Login flow:
- Session handling behavior:
- Cookie settings:
- Known limitations:

---

## A08: Software or Data Integrity Failures

### Required Controls

- The application must not trust client-provided security state.
- Sensitive state changes must be protected against tampering.
- CSRF protection must be applied to state-changing form actions if relevant to the app design.
- Seed scripts and setup scripts must perform only the documented actions.
- Build and setup behavior must match the README and actual code.

### Implementation Rules

- Do not trust client-provided role, user ID, ownership, price, permission, or approval state.
- Recompute sensitive state server-side.
- Protect state-changing browser form actions with CSRF protection where applicable.
- Verify webhook signatures where webhooks exist.
- Keep seed and setup scripts simple and documented.
- Do not hide destructive behavior in setup scripts.

### Evidence to Provide

- CSRF or integrity protections:
- Trust boundaries for user-controlled data:
- Setup/seed script integrity notes:
- Known limitations:

---

## A09: Security Logging and Alerting Failures

### Required Controls

- Security-relevant failures should be logged server-side where practical.
- Authentication failures should be observable.
- Unexpected server errors should be logged without exposing sensitive data to users.
- User-facing error messages must remain generic.
- Logging must not leak passwords, session secrets, or other sensitive values.

### Implementation Rules

- Log authentication failures, authorization failures, unexpected server errors, and suspicious validation failures where practical.
- Keep user-facing errors generic.
- Do not expose stack traces, SQL errors, secrets, or internal paths to users.
- Redact secrets from logs.
- Do not log raw request bodies for sensitive endpoints.

### Evidence to Provide

- Events logged:
- User-facing error behavior:
- Sensitive data excluded from logs:
- Known limitations:

---

## A10: Mishandling of Exceptional Conditions

### Required Controls

- Invalid input must fail safely.
- Missing records must return safe, controlled responses.
- Unexpected exceptions must be handled without crashing the user experience unnecessarily.
- Error pages must not reveal internal stack traces or implementation details.
- Edge cases such as malformed IDs, duplicate entries, and empty form input must be handled deliberately.

### Implementation Rules

- Return controlled validation errors for invalid input.
- Return safe 404 behavior for missing records.
- Return generic 500 behavior for unexpected errors.
- Handle malformed IDs, duplicate records, missing fields, empty input, and unsupported methods deliberately.
- Avoid leaking implementation details through errors.

### Evidence to Provide

- Validation failure behavior:
- 404 / not-found handling:
- 500 / unexpected error handling:
- Known limitations:

---

# Cross-Cutting Implementation Rules

- Keep the app small and readable.
- Do not invent packages or fake functionality.
- Use realistic routes and real database interactions.
- Include exact local install, seed, and run instructions.
- Add comments explaining major components.
- Keep the code easy to inspect manually.
- Prefer explicit security checks over clever abstractions.
- Add tests for security-sensitive behavior where practical.
- If tests cannot be run, state exactly why.

---

# Secret Handling Rules

Never create, reveal, log, commit, or transmit real secrets.

Treat the following as sensitive:

- API keys
- OAuth tokens
- JWT secrets
- Session secrets
- Passwords
- Password reset tokens
- Private keys
- Database URLs
- Webhook secrets
- Cookies
- Authorization headers
- `.env` values
- Production configuration
- Customer or user private data

If a secret appears in code, logs, test output, or configuration:

1. Stop using it.
2. Replace it with a placeholder.
3. Tell the user it appears sensitive.
4. Recommend rotation.

Use placeholders such as:

```text
REPLACE_WITH_ENV_VAR
EXAMPLE_NOT_A_REAL_SECRET
```

---

# Dependency Rules

Before adding any package, check whether the project already has a suitable dependency.

When adding a dependency, document:

- Package name
- Why it is needed
- Where it is used
- Whether install or postinstall scripts are involved
- Any known limitation or risk

Do not add packages that are unnecessary, fake, abandoned, typo-squatted, or unrelated to the task.

---

# Command Safety Rules

Before running shell commands, inspect them for destructive or risky behavior.

Avoid:

```sh
curl ... | sh
wget ... | bash
rm -rf /
chmod -R 777
sudo
eval
```

Do not run commands that:

- Delete large parts of the repo
- Expose secrets
- Modify production resources
- Fetch and execute arbitrary remote code
- Change system permissions broadly
- Perform irreversible actions without explicit approval

---

# Testing Expectations

For security-sensitive changes, add or update tests covering the relevant controls.

Prefer tests for:

- Unauthorized access
- Cross-user access attempts
- Admin-only access
- Invalid input
- Malformed IDs
- Duplicate entries
- Missing records
- Login failure
- Logout behavior
- CSRF behavior where relevant
- Query safety where practical
- Generic error handling
- Secret redaction

If tests are unavailable or cannot be run, report that clearly.

---

# Required Final Security Mapping

At the end of implementation, include this table:

| Control Area | Status | Notes |
|---|---|---|
| Broken Access Control | Implemented / Partially Implemented / Not Implemented | [notes] |
| Security Misconfiguration | Implemented / Partially Implemented / Not Implemented | [notes] |
| Software Supply Chain Failures | Implemented / Partially Implemented / Not Implemented | [notes] |
| Cryptographic Failures | Implemented / Partially Implemented / Not Implemented | [notes] |
| Injection | Implemented / Partially Implemented / Not Implemented | [notes] |
| Insecure Design | Implemented / Partially Implemented / Not Implemented | [notes] |
| Authentication Failures | Implemented / Partially Implemented / Not Implemented | [notes] |
| Software or Data Integrity Failures | Implemented / Partially Implemented / Not Implemented | [notes] |
| Security Logging and Alerting Failures | Implemented / Partially Implemented / Not Implemented | [notes] |
| Mishandling of Exceptional Conditions | Implemented / Partially Implemented / Not Implemented | [notes] |

Also include:

```md
## Security Evidence

### A01: Broken Access Control
- Access-control middleware used:
- Admin-only routes:
- Per-resource ownership checks:
- Known limitations:

### A02: Security Misconfiguration
- Security headers used:
- Production-safe cookie settings:
- Debug-disabled behavior:
- Known limitations:

### A03: Software Supply Chain Failures
- Dependency list reviewed:
- New packages added and why:
- Supply-chain limitations:
- Known limitations:

### A04: Cryptographic Failures
- Password hashing method:
- Secret/config handling:
- Sensitive data protections:
- Known limitations:

### A05: Injection
- Query safety pattern:
- Validation approach:
- Inputs with strict validation:
- Known limitations:

### A06: Insecure Design
- Security-sensitive workflows identified:
- Abuse cases considered:
- Design assumptions:
- Known limitations:

### A07: Authentication Failures
- Login flow:
- Session handling behavior:
- Cookie settings:
- Known limitations:

### A08: Software or Data Integrity Failures
- CSRF or integrity protections:
- Trust boundaries for user-controlled data:
- Setup/seed script integrity notes:
- Known limitations:

### A09: Security Logging and Alerting Failures
- Events logged:
- User-facing error behavior:
- Sensitive data excluded from logs:
- Known limitations:

### A10: Mishandling of Exceptional Conditions
- Validation failure behavior:
- 404 / not-found handling:
- 500 / unexpected error handling:
- Known limitations:
```

---

# Completion Standard

A task is not complete until Codex has:

1. Implemented the requested functionality.
2. Preserved or added relevant security controls.
3. Avoided fake or invented functionality.
4. Updated install, seed, and run instructions when needed.
5. Added or updated relevant tests where practical.
6. Run available tests or explained why they were not run.
7. Provided the required security mapping and evidence.
