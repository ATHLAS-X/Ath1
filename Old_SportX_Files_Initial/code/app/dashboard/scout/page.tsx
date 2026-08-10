/* Role-scoped scout dashboard lives at /dashboard/scout — middleware enforces
   role='scout' AND account_status='active'. The actual UI is the existing
   /scout/dashboard page, which we re-export here so both URLs work. */
export { default } from "@/app/scout/dashboard/page";
