export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startStaffJobs } = await import("./lib/staff-jobs");
    startStaffJobs();
  }
}
