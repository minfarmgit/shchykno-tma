import type { BindingStatus, BootstrapResponse, CourseDto } from "@/lib/contracts";
import type { TelegramInitDataUser } from "@/lib/telegram";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

interface CourseRow {
  id: string;
  external_id: string;
  title: string;
  subtitle: string | null;
  cover_image_url: string | null;
  buy_url: string;
  access_url: string | null;
}

interface TelegramUserRow {
  id: string;
  telegram_user_id: number;
  username: string | null;
  first_name: string;
  phone_number: string | null;
}

interface BrowserSessionRow {
  session_id: string;
  telegram_user_id: string | null;
}

function mapCourse(row: CourseRow): CourseDto {
  return {
    id: row.id,
    externalId: row.external_id,
    title: row.title,
    subtitle: row.subtitle ?? "",
    coverImageUrl: row.cover_image_url,
    buyUrl: row.buy_url,
    accessUrl: row.access_url,
  };
}

async function getPublishedCourses(client: SupabaseAdminClient): Promise<CourseDto[]> {
  const result = await client
    .from("courses")
    .select(
      "id, external_id, title, subtitle, cover_image_url, buy_url, access_url",
    )
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (result.error) {
    throw new Error(`Failed to load courses: ${result.error.message}`);
  }

  return (result.data as CourseRow[]).map(mapCourse);
}

async function getOwnedExternalIds(
  client: SupabaseAdminClient,
  telegramUserId: string,
): Promise<Set<string>> {
  const sessionResult = await client
    .from("browser_sessions")
    .select("session_id")
    .eq("telegram_user_id", telegramUserId);

  if (sessionResult.error) {
    throw new Error(`Failed to load browser sessions: ${sessionResult.error.message}`);
  }

  const sessionIds = sessionResult.data.map((row) => row.session_id);

  if (sessionIds.length === 0) {
    return new Set<string>();
  }

  const submissionsResult = await client
    .from("tilda_submissions")
    .select("course_external_id")
    .eq("match_status", "matched")
    .in("session_id", sessionIds);

  if (submissionsResult.error) {
    throw new Error(`Failed to load submissions: ${submissionsResult.error.message}`);
  }

  return new Set(submissionsResult.data.map((row) => row.course_external_id));
}

export async function upsertTelegramUser(
  client: SupabaseAdminClient,
  telegramUser: TelegramInitDataUser,
): Promise<TelegramUserRow> {
  const result = await client
    .from("telegram_users")
    .upsert(
      {
        telegram_user_id: telegramUser.id,
        username: telegramUser.username ?? null,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "telegram_user_id" },
    )
    .select("id, telegram_user_id, username, first_name, phone_number")
    .single();

  if (result.error) {
    throw new Error(`Failed to upsert telegram user: ${result.error.message}`);
  }

  return result.data as TelegramUserRow;
}

export async function saveTelegramPhoneNumber(
  client: SupabaseAdminClient,
  params: {
    telegramUserId: number;
    firstName: string;
    username?: string | null;
    phoneNumber: string;
  },
) {
  const confirmedAt = new Date().toISOString();
  const result = await client
    .from("telegram_users")
    .upsert(
      {
        telegram_user_id: params.telegramUserId,
        first_name: params.firstName,
        username: params.username ?? null,
        phone_number: params.phoneNumber,
        phone_number_confirmed_at: confirmedAt,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "telegram_user_id" },
    )
    .select("id, telegram_user_id, username, first_name, phone_number")
    .single();

  if (result.error) {
    throw new Error(`Failed to save telegram phone number: ${result.error.message}`);
  }

  return {
    row: result.data as TelegramUserRow,
    confirmedAt,
  };
}

async function readBrowserSession(
  client: SupabaseAdminClient,
  sessionId: string,
): Promise<BrowserSessionRow | null> {
  const result = await client
    .from("browser_sessions")
    .select("session_id, telegram_user_id")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (result.error) {
    throw new Error(`Failed to load browser session: ${result.error.message}`);
  }

  return result.data as BrowserSessionRow | null;
}

export async function ensureBrowserSessionExists(
  client: SupabaseAdminClient,
  sessionId: string,
): Promise<void> {
  const result = await client
    .from("browser_sessions")
    .upsert({ session_id: sessionId }, { onConflict: "session_id" });

  if (result.error) {
    throw new Error(`Failed to ensure browser session: ${result.error.message}`);
  }
}

export async function bindBrowserSession(
  client: SupabaseAdminClient,
  sessionId: string,
  telegramUserId: string,
): Promise<BindingStatus> {
  const existingRow = await readBrowserSession(client, sessionId);

  if (!existingRow) {
    const insertResult = await client
      .from("browser_sessions")
      .insert({
        session_id: sessionId,
        telegram_user_id: telegramUserId,
        bound_at: new Date().toISOString(),
      })
      .select("session_id, telegram_user_id")
      .maybeSingle();

    if (!insertResult.error) {
      return "linked";
    }
  }

  const currentRow = (await readBrowserSession(client, sessionId)) ?? existingRow;

  if (!currentRow) {
    throw new Error("Browser session could not be created.");
  }

  if (currentRow.telegram_user_id === telegramUserId) {
    return "already_linked";
  }

  if (!currentRow.telegram_user_id) {
    const updateResult = await client
      .from("browser_sessions")
      .update({
        telegram_user_id: telegramUserId,
        bound_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)
      .is("telegram_user_id", null)
      .select("session_id, telegram_user_id")
      .maybeSingle();

    if (updateResult.error) {
      throw new Error(`Failed to bind browser session: ${updateResult.error.message}`);
    }

    if (updateResult.data) {
      return "linked";
    }

    const refreshedRow = await readBrowserSession(client, sessionId);

    if (refreshedRow?.telegram_user_id === telegramUserId) {
      return "already_linked";
    }
  }

  return "conflict";
}

export async function upsertTildaSubmission(
  client: SupabaseAdminClient,
  params: {
    tranId: string;
    formId: string | null;
    sessionId: string;
    courseExternalId: string;
    courseTitle: string | null;
    rawPayload: Record<string, string | string[]>;
  },
): Promise<"matched" | "unmatched"> {
  const courseLookup = await client
    .from("courses")
    .select("external_id")
    .eq("external_id", params.courseExternalId)
    .maybeSingle();

  if (courseLookup.error) {
    throw new Error(`Failed to check course match: ${courseLookup.error.message}`);
  }

  const matchStatus = courseLookup.data ? "matched" : "unmatched";
  const result = await client.from("tilda_submissions").upsert(
    {
      tranid: params.tranId,
      formid: params.formId,
      session_id: params.sessionId,
      course_external_id: params.courseExternalId,
      course_title: params.courseTitle,
      raw_payload: params.rawPayload,
      match_status: matchStatus,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tranid" },
  );

  if (result.error) {
    throw new Error(`Failed to save Tilda submission: ${result.error.message}`);
  }

  return matchStatus;
}

export async function buildBootstrapResponse(params: {
  client: SupabaseAdminClient;
  telegramUserRow: TelegramUserRow;
  telegramUser: TelegramInitDataUser;
  bindingStatus: BindingStatus;
  conflictSessionId: string | null;
}): Promise<BootstrapResponse> {
  const [publishedCourses, ownedExternalIds] = await Promise.all([
    getPublishedCourses(params.client),
    getOwnedExternalIds(params.client, params.telegramUserRow.id),
  ]);

  return {
    bindingStatus: params.bindingStatus,
    conflictSessionId: params.conflictSessionId,
    ownedCourses: publishedCourses.filter((course) =>
      ownedExternalIds.has(course.externalId),
    ),
    availableCourses: publishedCourses.filter(
      (course) => !ownedExternalIds.has(course.externalId),
    ),
    user: {
      id: params.telegramUser.id,
      firstName: params.telegramUser.first_name,
      username: params.telegramUser.username ?? null,
      phoneNumber: params.telegramUserRow.phone_number,
      hasPhoneNumber: Boolean(params.telegramUserRow.phone_number),
    },
  };
}
