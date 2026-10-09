import { listAllProfiles } from "@/lib/profiles";
import {
  Card,
  CountBadge,
  EmptyRow,
  FilterBar,
  Mono,
  Muted,
  PageHeader,
  Pagination,
  Table,
  TextLink,
} from "../components/ui";

const PER_PAGE = 25;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const { profiles, total } = await listAllProfiles({
    search: q,
    limit: PER_PAGE,
    offset: (currentPage - 1) * PER_PAGE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <PageHeader title="Users" count={total} />

      <FilterBar q={q} placeholder="Search name or email" />

      <Card padding="flush">
        <Table headers={["User", "Email", "Slack ID", "Interest", "Wonders", "Joined"]}>
          {profiles.map((profile) => (
            <tr key={profile.id}>
              <td>
                <TextLink href={`/admin/users/${profile.id}`} className="font-bold">
                  {profile.name ? profile.name : profile.email}
                </TextLink>
                {!profile.name && (
                  <div className="text-xs">
                    <Muted>no name from Hack Club Auth yet</Muted>
                  </div>
                )}
              </td>
              <td>{profile.email}</td>
              <td>
                <Mono>{profile.slack_id}</Mono>
              </td>
              <td>{profile.interest ? profile.interest : <Muted>—</Muted>}</td>
              <td>
                <CountBadge>{profile.wonder_count}</CountBadge>
              </td>
              <td>
                <Muted>
                  <Mono>{new Date(profile.created_at).toLocaleDateString()}</Mono>
                </Muted>
              </td>
            </tr>
          ))}
          {profiles.length === 0 && (
            <EmptyRow colSpan={6} title="No users found" icon="search">
              Try a different name or email.
            </EmptyRow>
          )}
        </Table>
      </Card>

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        hrefFor={(p) => `/admin/users?q=${encodeURIComponent(q ?? "")}&page=${p}`}
      />
    </div>
  );
}
