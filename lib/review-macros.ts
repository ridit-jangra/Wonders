import "server-only";
import { sql } from "@/lib/db";

export interface ReviewMacro {
  id: number;
  title: string;
  body: string;
  created_by: string;
  created_at: string;
}

export const MACRO_TITLE_MAX = 80;
export const MACRO_BODY_MAX = 2000;
const MACRO_LIMIT = 200;

export async function listMacros(): Promise<ReviewMacro[]> {
  return sql<ReviewMacro[]>`
    select id, title, body, created_by, created_at
    from review_macros order by lower(title), id
  `;
}

export async function createMacro(title: string, body: string, createdBy: string): Promise<boolean> {
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  if (!cleanTitle || cleanTitle.length > MACRO_TITLE_MAX) return false;
  if (!cleanBody || cleanBody.length > MACRO_BODY_MAX) return false;
  const rows = await sql`
    insert into review_macros (title, body, created_by)
    select ${cleanTitle}, ${cleanBody}, ${createdBy}
    where (select count(*) from review_macros) < ${MACRO_LIMIT}
    returning id
  `;
  return rows.length > 0;
}

export async function deleteMacro(id: number, actorSlackId: string, isAdmin: boolean): Promise<boolean> {
  const rows = await sql`
    delete from review_macros
    where id = ${id} and (${isAdmin} or created_by = ${actorSlackId})
    returning id
  `;
  return rows.length > 0;
}
