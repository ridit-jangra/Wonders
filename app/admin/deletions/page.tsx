import { sql } from "@/lib/db";
import { requireAccess } from "@/lib/admin";
import { canManagePlayers } from "@/lib/security/roles";
import AdminTime from "../components/AdminTime";
import { Badge, Card, EmptyRow, Mono, Muted, PageHeader, Table, TextLink } from "../components/ui";

interface Request {
  id: string;
  actor_slack_id: string;
  target: string | null;
  detail: { reason?: string; name?: string };
  created_at: string;
  profile_id: string | null;
  profile_name: string | null;
}

export default async function AdminDeletionsPage() {
  await requireAccess(canManagePlayers);
  const rows = await sql<Request[]>`
    select a.id, a.actor_slack_id, a.target, a.detail, a.created_at,
      p.id as profile_id, coalesce(nullif(p.slack_display_name, ''), p.name) as profile_name
    from audit_logs a
    left join profiles p on p.slack_id = a.actor_slack_id
    where a.action = 'account.delete_request'
    order by a.created_at desc
    limit 200
  `;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Deletion requests"
        count={rows.length}
        description="Players who asked for their account to be deleted from /delete-account. Open the user to ban or review them, then delete the profile by hand."
      />
      <Card padding="flush">
        <Table headers={["Player", "Note", "Status", "Requested"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                {row.profile_id ? (
                  <TextLink href={`/admin/users/${row.profile_id}`}>{row.profile_name || row.actor_slack_id}</TextLink>
                ) : (
                  <span>{row.detail.name || "unknown"}</span>
                )}
                <div>
                  <Mono>{row.actor_slack_id}</Mono>
                </div>
              </td>
              <td className="whitespace-pre-wrap">{row.detail.reason || <Muted>-</Muted>}</td>
              <td>{row.profile_id ? <Badge tone="warning">Pending</Badge> : <Badge tone="success">Deleted</Badge>}</td>
              <td className="whitespace-nowrap">
                <Muted>
                  <Mono>
                    <AdminTime iso={row.created_at} />
                  </Mono>
                </Muted>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <EmptyRow colSpan={4} title="No requests" icon="checkmark-all">
              Nobody has asked to delete their account.
            </EmptyRow>
          )}
        </Table>
      </Card>
    </div>
  );
}
