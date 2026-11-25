# Navigation architecture

Approved Creator Studio: Home (M04), Grow (M05/M06/M07), Create (M08), Collaborate (M10/M11/M12), My Studio (M09/M13 and settings). Mobile bottom navigation and extended drawer; contextual AI, search, notifications, quick-create and workspace switcher globally. Desktop sidebar proposed.

Public website: see M01. Auth: see M02. Preserve intended destination through login and onboarding; validate redirects to prevent open redirect.

Brand: onboarding M14 approved. Six proposed navigation areas Home / Discover / Campaigns / Grow / Create / Business are M15 discussion only. Do not build them as finalized screens. Minimum private landing for onboarding continuity may be proposed separately and reviewed before implementation. No placeholder navigation claiming unimplemented functionality.

Workspace switch: resolve authorized membership server-side, clear workspace-specific cached state, revalidate permission, restore last authorized workspace; never switch via client-only role flag. No public admin registration.
