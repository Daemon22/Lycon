# Authentication System Setup Guide

This guide walks through setting up the new authentication system for Lycon Browser.

## Prerequisites

1. **Neon PostgreSQL Database**: Set up a Neon project and get connection strings
2. **SMTP Server** (optional but recommended): For email verification and password reset
3. **Environment Variables**: Configure all required environment variables

## Database Setup

### 1. Configure Environment Variables

Update your `.env` file with Neon database credentials:

```bash
LYCON_NEON_DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
LYCON_NEON_DATABASE_URL_DIRECT=postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

### 2. Run Database Migrations

Generate and apply migrations:

```bash
pnpm db:push
```

This will create the following tables:
- `users` - User accounts
- `browser_sync_snapshots` - Sync data
- `email_verification_tokens` - Email verification
- `password_reset_tokens` - Password reset
- `two_factor_secrets` - 2FA configuration
- `rate_limit_logs` - Rate limiting

## Email Configuration (Optional but Recommended)

### SMTP Setup

Configure SMTP in your `.env` file:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@lycon.browser
```

### Recommended SMTP Providers

- **Gmail**: Use App Password (not your regular password)
- **SendGrid**: Free tier available
- **Mailgun**: Good for transactional emails
- **AWS SES**: Cost-effective for high volume

## Application Configuration

### Required Environment Variables

```bash
# Database
LYCON_NEON_DATABASE_URL=postgresql://...
LYCON_NEON_DATABASE_URL_DIRECT=postgresql://...

# App
APP_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Security
JWT_SECRET=minimum-32-characters-long-random-string
NODE_ENV=production

# OAuth (existing)
OAUTH_SERVER_URL=https://oauth.manus.space
VITE_APP_ID=your-app-id
VITE_OAUTH_PORTAL_URL=https://oauth.manus.space
```

### Generate JWT Secret

Generate a secure random secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Running the Application

### Development

```bash
pnpm dev
```

The server will start on `http://localhost:3000`

### Production

```bash
pnpm build
pnpm start
```

## Testing the Authentication System

### 1. Email/Password Registration

Navigate to the registration page and:
- Enter email and password
- Submit form
- Check email for verification link
- Click verification link

### 2. Login

Navigate to the login page and:
- Enter email and password
- Submit form
- Should redirect to home page

### 3. Password Reset

Navigate to password reset page and:
- Enter email
- Check email for reset link
- Click reset link
- Enter new password
- Submit

### 4. Two-Factor Authentication

To enable 2FA:
- Go to account settings
- Click "Enable 2FA"
- Scan QR code with authenticator app
- Enter verification code
- Save backup codes

## Frontend Integration

### Using Auth Components

Import and use the auth components in your React pages:

```tsx
import { LoginForm } from "@/components/Auth/LoginForm";
import { RegisterForm } from "@/components/Auth/RegisterForm";
import { PasswordResetForm } from "@/components/Auth/PasswordResetForm";

// In your page
export default function LoginPage() {
  return <LoginForm />;
}
```

### Using Auth Hook

The `useAuth` hook provides authentication state:

```tsx
import { useAuth } from "@/hooks/useAuth";

export default function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      Welcome, {user?.name}
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

## Security Best Practices

### 1. Never Commit Secrets

Ensure `.env` is in `.gitignore`:

```gitignore
.env
.env.local
.env.production
```

### 2. Use Strong Secrets

- JWT Secret: Minimum 32 characters, randomly generated
- Database Passwords: Use Neon's auto-generated or strong passwords
- SMTP Passwords: Use app-specific passwords

### 3. Enable HTTPS in Production

- Configure reverse proxy (nginx, Apache, or cloud service)
- Set `NODE_ENV=production`
- Security headers will automatically enforce HTTPS

### 4. Monitor Rate Limits

Check logs for rate limit violations:
- Multiple failed login attempts
- Spam registration attempts
- Abnormal API usage

### 5. Regular Security Audits

- Update dependencies monthly: `pnpm update`
- Run security audit: `pnpm audit`
- Review SECURITY.md for guidelines

## Troubleshooting

### Database Connection Issues

**Error**: "Database not available"

**Solution**:
1. Check `LYCON_NEON_DATABASE_URL` is set correctly
2. Verify Neon project is active
3. Check network connectivity

### Email Not Sending

**Error**: "Email service not configured"

**Solution**:
1. Verify SMTP credentials
2. Check SMTP server is accessible
3. Check spam folder for test emails

### Rate Limiting Too Strict

**Error**: "Too many requests"

**Solution**:
1. Adjust limits in `server/_core/rateLimit.ts`
2. Clear rate limit logs from database
3. Implement CAPTCHA for abusive IPs

### 2FA Not Working

**Error**: "Invalid verification code"

**Solution**:
1. Check device time is synchronized
2. Verify authenticator app is using correct secret
3. Use backup code if available

## Migration from MySQL to PostgreSQL

If migrating existing data from MySQL:

1. Export MySQL data
2. Transform schema to match PostgreSQL structure
3. Import to Neon
4. Update environment variables
5. Test authentication flows

See `SECURITY.md` for detailed security architecture.

## Support

For issues or questions:
- Check `SECURITY.md` for security documentation
- Review test files for implementation examples
- Check console logs for error messages

---

**Last Updated**: 2026-11-03
