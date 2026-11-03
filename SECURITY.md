# Security Architecture & Best Practices

This document outlines the security architecture, best practices, and compliance measures implemented in Lycon Browser's authentication and data protection systems.

## Overview

Lycon Browser implements a comprehensive security framework to protect user data, prevent unauthorized access, and ensure compliance with data protection regulations (GDPR).

## Authentication System

### Supported Authentication Methods

1. **OAuth 2.0** (via Manus OAuth)
   - Google, GitHub, Apple, Microsoft, Email
   - CSRF-protected state parameter
   - Secure session tokens (JWT)

2. **Email/Password**
   - Argon2id password hashing (memory-hard, resistant to GPU/ASIC attacks)
   - Minimum 8 characters, requires letter + number
   - Maximum 128 characters

### Security Features

#### Password Security
- **Hashing Algorithm**: Argon2id with the following parameters:
  - Memory cost: 64MB
  - Time cost: 3 iterations
  - Parallelism: 4 threads
  - This configuration provides ~100ms hashing time on modern hardware

- **Password Requirements**:
  - Minimum 8 characters
  - Maximum 128 characters
  - At least one letter
  - At least one number

#### Session Management
- **Session Tokens**: JWT signed with HS256
- **Cookie Security**:
  - `httpOnly`: Prevents JavaScript access (XSS protection)
  - `secure`: Only sent over HTTPS
  - `sameSite`: `strict` in production, `lax` in development (CSRF protection)
  - `path`: `/` (scoped to entire application)
- **Session Duration**: 1 year (configurable)
- **Session Revocation**: Immediate on logout

#### Two-Factor Authentication (2FA)
- **Algorithm**: TOTP (Time-based One-Time Password)
- **Implementation**: Uses `otplib` with authenticator apps (Google Authenticator, Authy, etc.)
- **Backup Codes**: 10 single-use codes provided during setup
- **Enforcement**: Optional per user, required for admin accounts

### Rate Limiting

To prevent brute force attacks and abuse, rate limiting is implemented on sensitive endpoints:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/register` | 3 requests | 1 hour |
| `/api/auth/login` | 5 requests | 15 minutes |
| `/api/auth/password-reset-request` | 3 requests | 1 hour |
| `/api/auth/password-reset-confirm` | 3 requests | 1 hour |

Rate limiting is tracked per IP address in the database and includes HTTP headers:
- `X-RateLimit-Limit`: Maximum requests
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Data Protection

### Encryption

#### Encryption at Rest
- Database: PostgreSQL (Neon) with transparent encryption
- Passwords: Argon2id hashing (one-way, not reversible)
- Session tokens: JWT signed with secret key
- Email verification tokens: Cryptographically random (32 bytes)

#### Encryption in Transit
- TLS 1.2+ required for all connections
- HTTP Strict Transport Security (HSTS) enabled
- 1-year max-age with includeSubDomains

### Input Validation & Sanitization

All user inputs are validated and sanitized:

1. **Validation**: Zod schemas enforce type safety and format rules
2. **Sanitization**: Strips potentially dangerous characters (`<`, `>`)
3. **SQL Injection Prevention**: Parameterized queries via Drizzle ORM
4. **XSS Prevention**: Content Security Policy (CSP) headers

### Security Headers

Implemented via Helmet:

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### CSRF Protection

- **OAuth State**: One-time nonce stored in `__Host-oauth_state` cookie
- **Origin Validation**: Checks `Origin` and `Referer` headers for state-changing requests
- **SameSite Cookies**: Strict setting in production

## Database Security

### Access Control

- **Environment Variables**: Database credentials stored in environment variables (never committed)
- **Connection Pooling**: Neon pooled connections for production
- **Direct Connections**: Direct connections for migrations/admin

### Schema Design

- **Foreign Keys**: Cascading deletes for related data
- **Unique Constraints**: Prevent duplicate emails, openIds
- **Indexes**: Optimized for common queries
- **Timestamps**: `createdAt`, `updatedAt` on all tables

### Data Retention

- **Email Verification Tokens**: 24 hours
- **Password Reset Tokens**: 1 hour
- **Rate Limit Logs**: Cleaned automatically when expired
- **User Data**: Retained until account deletion (GDPR right to be forgotten)

## GDPR Compliance

### Data Export

Users can export all their data via `/api/auth/exportData`:
- User profile information
- Browser sync snapshots
- 2FA status (without secrets)
- Export timestamp

### Data Deletion

Users can delete their account via `/api/auth/deleteAccount`:
- Requires password verification
- Irreversible deletion of:
  - User profile
  - Browser sync snapshots
  - Email verification tokens
  - Password reset tokens
  - 2FA secrets
- Logs deletion for audit trail

### Data Anonymization

Alternative to full deletion:
- Email replaced with `deleted_{id}@anonymous.local`
- Name replaced with "Deleted User"
- Password hash removed
- Account retained for data continuity

## Email Security

### SMTP Configuration

Emails are sent via SMTP with the following security measures:

- **TLS Encryption**: Optional based on `SMTP_SECURE` setting
- **Authentication**: Username/password required
- **Rate Limiting**: Respects SMTP provider limits
- **Bounce Handling**: Logs failed deliveries

### Email Types

1. **Email Verification**: One-time use, expires in 24 hours
2. **Password Reset**: One-time use, expires in 1 hour
3. **2FA Setup**: Contains backup codes, sent immediately after setup

## OAuth Security

### State Parameter

CSRF protection via state parameter:
- Server generates one-time nonce
- Stored in `__Host-oauth_state` cookie (host-only, secure)
- Included in OAuth redirect URL
- Verified on callback
- Prevents authorization code interception

### Token Handling

- **Authorization Code**: Single-use, exchanged for access token
- **Access Token**: Used to fetch user info
- **Session Token**: Generated by server, stored in HTTP-only cookie
- **No Client-Side Storage**: Sensitive tokens never in localStorage/sessionStorage

## Backup & Recovery

### Database Backups

Neon provides automated backups:
- **Point-in-Time Recovery**: 7-day retention
- **Physical Backups**: Daily, 30-day retention
- **Replication**: Multi-region for disaster recovery

### Disaster Recovery Plan

1. **Database Failure**: Restore from Neon backups
2. **Account Recovery**: Password reset flow
3. **Session Recovery**: Users re-authenticate with OAuth or email/password
4. **2FA Recovery**: Backup codes (10 provided)

## Security Testing

### Recommended Tests

1. **Authentication Flow Tests**
   - Registration with valid/invalid data
   - Login with correct/incorrect credentials
   - Email verification
   - Password reset
   - 2FA setup and verification

2. **Security Tests**
   - SQL injection attempts
   - XSS attempts
   - CSRF attacks
   - Rate limiting enforcement
   - Session hijacking prevention

3. **Compliance Tests**
   - Data export completeness
   - Data deletion thoroughness
   - Data anonymization effectiveness

### Penetration Testing

Regular penetration testing recommended:
- External penetration testing annually
- Internal security reviews quarterly
- Dependency vulnerability scanning (npm audit, Snyk)

## Monitoring & Logging

### Security Events to Monitor

- Failed login attempts (rate limiting)
- Multiple password reset requests
- 2FA disable attempts
- Account deletion requests
- Unauthorized access attempts
- Unusual API usage patterns

### Logging Best Practices

- Never log sensitive data (passwords, tokens, secrets)
- Use structured logging (JSON format)
- Include correlation IDs for request tracing
- Retain logs for 90 days (GDPR recommendation)
- Alert on critical security events

## Deployment Security

### Environment Variables

Required environment variables:

```bash
# Database
LYCON_NEON_DATABASE_URL=postgresql://...
LYCON_NEON_DATABASE_URL_DIRECT=postgresql://...

# Email (optional but recommended)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_FROM=noreply@lycon.browser

# App
APP_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Security
JWT_SECRET=minimum-32-characters-long-random-string
NODE_ENV=production
```

### Secrets Management

- **Development**: Use `.env` file (never committed)
- **Production**: Use environment variables or secret manager
- **CI/CD**: Use encrypted secrets (GitHub Actions Secrets, etc.)
- **Never commit**: `.env` files, API keys, or credentials

## Regular Security Maintenance

### Checklist

- [ ] Review and update dependencies monthly
- [ ] Run security audits (`npm audit`, `pnpm audit`)
- [ ] Review access logs weekly
- [ ] Test backup restoration quarterly
- [ ] Update security documentation annually
- [ ] Conduct penetration testing annually
- [ ] Review GDPR compliance annually

### Vulnerability Disclosure

For security researchers:
- Please report vulnerabilities via responsible disclosure
- Do not exploit vulnerabilities in production
- Allow 90 days for remediation before public disclosure
- Contact: security@lycon.browser (replace with actual contact)

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GDPR Compliance](https://gdpr.eu/)
- [Argon2 Specification](https://tools.ietf.org/html/rfc9106)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Last Updated**: 2026-11-03
**Version**: 1.0.0
