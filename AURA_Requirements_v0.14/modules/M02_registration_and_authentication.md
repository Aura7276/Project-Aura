# M02 — Registration and authentication

Status: business requirements approved; implementation details proposed.

## Functional requirements

- **M02-F01** Email/password and Google Sign-In.
- **M02-F02** Age 18+.
- **M02-F03** Mobile optional initially; required before designated commercial activities.
- **M02-F04** International registration, India primary.
- **M02-F05** One personal Creator workspace per identity; multiple social accounts.
- **M02-F06** Companies, startups, individual business owners and small businesses may create Brand workspaces.
- **M02-F07** Creator active after onboarding; Brand and Agency active with restricted privileges pending verification.
- **M02-F08** MFA mandatory for platform administrators and Brand/Agency owners; Creator optional. M14 extends to Brand administrators and designated privileged roles.
- **M02-F09** Save/resume incomplete onboarding; restrict affected features.
- **M02-F10** Restore last authorized workspace after login.
- **M02-F11** Active sessions, device history, logout all and security alerts.
- **M02-F12** Preserve campaign/referral context.
- **M02-F13** Platform Admin separately provisioned, never public self-registration.

Source note: reconstructed from prior decision summaries; numbering is a new local mapping, not an exact transcript. Confirm against original decisions if available.

## User journey
Register → verify email → basic identity → choose/create workspace → applicable MFA → onboarding → permitted dashboard. Login → authorize membership → last eligible workspace.

## Logical data entities
User, workspace, membership, invitation, session/device, MFA state, referral context, security event, verification state.

## Proposed screen inventory
Login, registration, email verification, recovery/reset, workspace selection/creation, invitation acceptance, MFA setup/challenge/recovery, restricted state, session expired, security settings, device history, mobile verification, separately provisioned admin login.

## Business rules and security
Account, membership, onboarding, verification and MFA are independent. Workspace authorization checked on every read/write. M14 permits multiple isolated Brand workspaces. Do not grant admin privileges via public sign-up.

## Acceptance and negative tests
- M02-AC01: Real email/password and Google auth flows work when configured.
- M02-AC02: Expired/invalid tokens rejected; recovery and logout-all tested.
- M02-AC03: MFA gates privileged actions and cannot be bypassed via API.
- M02-AC04: Cross-workspace and role escalation attempts denied.
- M02-AC05: Onboarding resume and campaign/referral deep links work.

## Outstanding decisions / dependencies
Exact commercial mobile triggers, recovery procedure, session retention and OAuth/SMTP configuration remain open.
