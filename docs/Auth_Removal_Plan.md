# Plan: Remove Login/Registration Functionality

The goal is to remove the requirement for users to log in or register to use the platform. The application will instead use a default authenticated session for all actions.

## User Review Required

> [!IMPORTANT]
> This change will make the application accessible to anyone without credentials. 
> All actions (creating projects, running tests, etc.) will be attributed to a single default "System Admin" user.

## Proposed Changes

### Backend

#### [MODIFY] [auth.ts](file:///e:/Test/backend/src/middleware/auth.ts)
- Modify `authenticate` middleware to skip token verification and always attach a default user payload to `req.user`.
- Modify `authorize` middleware to always permit all roles.

#### [MODIFY] [index.ts](file:///e:/Test/backend/src/index.ts)
- Add a startup check to ensure a default admin user exists in the `users` table so that foreign key relationships remain valid.
- (Optional) Remove the `/api/auth` route registration.

---

### Frontend

#### [MODIFY] [api.ts](file:///e:/Test/frontend/src/services/api.ts)
- Remove request interceptor that attaches the Bearer token.
- Remove response interceptor that handles 401 errors and token refreshing.
- Remove `authAPI` methods as they will no longer be used.

#### [DELETE] [login/page.tsx](file:///e:/Test/frontend/src/app/login/page.tsx)
- Remove the login/registration page.

#### [MODIFY] [layout.tsx](file:///e:/Test/frontend/src/app/layout.tsx)
- Ensure any auth-related logic or guarded navigation is removed.

## Verification Plan

### Automated Tests
- I will run the existing UI tests in `backend/src/scripts/ui-tests.ts` (if applicable) to ensure the application still works.
- I will perform basic API health checks without providing any Authorization headers.

### Manual Verification
1. Access the frontend in the browser.
2. Verify it no longer redirects to `/login`.
3. Perform actions like creating a project and a test case to ensure they work without being logged in.
