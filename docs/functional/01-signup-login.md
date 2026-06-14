# Sign Up & Log In

**Where:** `/signup` and `/login`
**Who uses it:** New venue owners creating an account; existing venue staff signing back in
**Status:** Built ✅

## In plain English

These are the two screens that control who can get into VenueFlow. A brand-new owner visits `/signup`, picks an email and password, and confirms their email before they can do anything. A returning user goes to `/login` and either types their password or asks for a one-click "magic link" sent to their inbox. Once the system knows who you are, it decides where to send you — first-timers go to set up their venue, everyone else goes straight to the dashboard.

## What you see / what you can do

**Sign-up page (`/signup`)**
- A "VenueFlow" wordmark in the top-left corner, no navigation bars or menus
- A card in the center of the screen with the heading "Create your account"
- Sub-heading: "Get started with VenueFlow. No credit card required."
- Three fields: Email, Password, Confirm password
- A "Create account" button (disabled while the form is submitting)
- A link at the bottom to go to the sign-in page if you already have an account
- Inline error messages under each field if something is wrong
- After submitting: the card switches to a "Check your email" message with a "Back to sign up" button

**Login page (`/login`)**
- Same VenueFlow wordmark and centered-card layout
- Heading: "Sign in", sub-heading: "Welcome back. Enter your details to continue."
- Two fields: Email and Password
- A "Sign in" button (primary, disabled while submitting)
- An "Email me a magic link" button below it (secondary, outline style)
- A link at the bottom to create an account if you don't have one
- After requesting a magic link: the card switches to a "Check your email" message with a "Back to sign in" button

## How it works, step by step

### onSubmit (sign-up)
1. You fill in your email, a password (minimum 8 characters), and the same password again to confirm.
2. The form checks locally that both passwords match and the email looks valid. If not, red error messages appear under the relevant fields and nothing is sent.
3. If the fields are valid, the "Create account" button shows "Creating account…" and becomes unclickable.
4. The system sends the email and password to Supabase (the authentication service).
5. Supabase sends you a confirmation email with a link to activate your account.
6. The card on screen changes to say "Check your email — we sent a confirmation link. Click it to activate your account." A "Back to sign up" button lets you correct a typo and try again.
7. If Supabase returns an error (e.g. that email is already registered), a red message appears at the top of the form.

> **Note:** There is a fast-path: if email confirmation is turned off in the Supabase project settings, a session is created immediately and you are sent straight to `/onboarding` without the check-your-email step. This is a back-end configuration switch, not something visible in the UI.

### onSubmit (login with password)
1. You type your email and password, then click "Sign in."
2. The form checks locally that the email looks valid and the password is at least 8 characters. Field-level errors appear instantly if not.
3. The button shows "Signing in…" and becomes unclickable while the request is in flight.
4. The system sends the credentials to Supabase.
5. If correct, you are redirected to `/dashboard`.
6. If wrong, a red error message from Supabase appears at the top of the form (e.g. "Invalid login credentials").

### handleMagicLink (passwordless login)
1. You type your email in the Email field on the login page.
2. You click "Email me a magic link" without filling in the password.
3. If the Email field is empty, a red message appears telling you to enter your email first.
4. If an email is present, the magic-link button shows "Sending link…" and becomes unclickable. The "Sign in" button is not affected — it stays enabled during this step (it is only disabled during a password sign-in attempt).
5. A one-time sign-in link is sent to that email address. **Important:** this only works if the email already has an account — it will not create a new one.
6. The card switches to "Check your email — we sent a sign-in link. Click it to continue."
7. You click the link in your email. The app code does not set a redirect URL when it sends the magic link, so where the link lands depends on the redirect URL configured in the Supabase project settings (intended destination: `/callback` — see below). Note: sign-up confirmation links do explicitly point to `/callback` in code; magic links rely on the Supabase project default.

### GET /callback (background — handles the link click)
1. When you click a confirmation link (from sign-up) or a magic link (from login), your browser lands on `/callback` with a short one-time code in the URL.
2. The system exchanges that code for a real login session. This happens server-side; you never see this page.
3. If no code is present, you are sent back to `/login?error=missing_code`. If the code exchange fails, you are sent to `/login?error=callback_failed`. If the exchange succeeds but no user session can be confirmed, you are sent to `/login?error=no_user`.
4. After a successful exchange, the system checks whether your account is connected to any venue yet:
   - **No venue yet** → sent to `/onboarding` to set up your venue.
   - **Already has a venue** → sent to `/dashboard`.

## Workflow

```
Visitor
   │
   ▼
Have an account?
   ├─ no  ─▶ Go to /signup
   │           │
   │           ▼
   │        Fill in email + password + confirm
   │           │
   │           ▼
   │        Valid?
   │           ├─ no  ─▶ Show field errors ─▶ (back to form)
   │           └─ yes ─▶ Supabase sends confirmation email
   │                        │
   │                        ▼
   │                     Show: "Check your email"
   │                        │
   │                        ▼
   │                     User clicks link in email ─▶ /callback
   │
   └─ yes ─▶ Go to /login
               │
               ▼
            How to sign in?
               ├─ Password ─▶ Fill email + password, Sign in
               │                 │
               │                 ▼
               │              Correct?
               │                 ├─ no  ─▶ Show error ─▶ (try again)
               │                 └─ yes ─▶ /dashboard
               │
               └─ Magic link ─▶ Type email, click
                                "Email me a magic link"
                                   │
                                   ▼
                                Supabase sends magic-link email
                                   │
                                   ▼
                                Show: "Check your email"
                                   │
                                   ▼
                                User clicks link ─▶ /callback

/callback — exchange code for a login session
   │
   ▼
Has a venue?
   ├─ no  ─▶ /onboarding
   └─ yes ─▶ /dashboard
```

## Data it touches

- **auth.users** (Supabase built-in) — a new row is created when you sign up; read when you sign in
- **memberships** table — read at `/callback` to decide where to send you (onboarding vs dashboard); never written during sign-up or login

## Rules & edge cases

- Passwords must be at least 8 characters; the form will not let you submit with fewer.
- The two password fields on sign-up must match exactly; a mismatch is caught before anything is sent to the server.
- The "Email me a magic link" button requires an email address already in the field — clicking it with an empty email shows an inline error.
- Magic links will **not** create a new account — if the email isn't registered, Supabase will return an error.
- If the one-time code in a callback URL is missing, you are redirected to `/login?error=missing_code`. If the code exchange fails (e.g. already used or expired), you are redirected to `/login?error=callback_failed`. If the exchange succeeds but no user session can be confirmed, you are redirected to `/login?error=no_user`. The login page does not currently display a human-readable message for any of these URL error flags (the param is present in the URL but not rendered on screen).
- There is no "Forgot password" / password-reset flow visible on the login page. The magic-link option serves as the passwordless alternative, but a dedicated reset flow is not built yet.
- The sign-up and login pages have no top navigation, sidebar, or footer — just the VenueFlow wordmark and the form card.
- There is no "Remember me" or "Stay signed in" toggle — session handling is managed by Supabase's default cookie behaviour.

## Approve this page

Tick each statement if it's correct. These must be concrete, independently true/false behavior claims that together fully describe this surface — phrased so the venue owner can confirm them:

- [ ] Signing up asks for email, password, and a confirm-password field — nothing else (no name, phone, company, card number).
- [ ] After a successful sign-up, the page shows a "Check your email" message rather than logging me in immediately.
- [ ] The "Create account" button is greyed out and unclickable while the form is being submitted.
- [ ] Signing in with the correct email and password takes me straight to `/dashboard`.
- [ ] Clicking "Email me a magic link" without typing an email first shows an inline error, not an email.
- [ ] The magic-link option only works for existing accounts — it will not create a new account.
- [ ] After clicking a magic link or confirmation link in my email, the system checks whether I have a venue set up; if not, I land on onboarding; if yes, I land on the dashboard.
- [ ] If the link in the email is broken or already used, I am redirected back to the login page (not a blank error screen).
- [ ] The sign-up and login pages have no top navigation or sidebar — just the VenueFlow wordmark and the form.
- [ ] There is no "Forgot password" link on the login page.
- [ ] Password rules are enforced before the form is sent — a password under 8 characters or a mismatched confirm field shows an error immediately.

**Wrong or missing anything?** _Write it here:_

## Open questions for you

- Should there be a dedicated "Forgot / reset password" link on the login page, or is the magic-link button sufficient for users who can't remember their password?
- The login page doesn't currently show a human-readable message when a broken or expired link redirects back to it (the error is only in the URL). Should it display something like "That link has expired — please try again"?
- If someone tries to sign up with an email address that's already registered, the error message they see comes directly from Supabase (e.g. "User already registered"). Do you want a custom, friendlier message for that case?
