import { supabase } from "../supabase";

export async function createEmailLog({
  organizationId,
  recipient,
  subject,
  emailType,
  relatedRecordId,
  relatedRecordNumber,
  status,
  providerEmailId = null,
  errorMessage = null,
}) {
  try {
    const { data, error } = await supabase
      .from("email_logs")
      .insert([
        {
          organization_id: organizationId,

          recipient:
            String(recipient || "").trim(),

          subject:
            String(subject || "").trim(),

          email_type:
            String(emailType || "").trim(),

          related_record_id:
            relatedRecordId || null,

          related_record_number:
            relatedRecordNumber || null,

          status:
            status || "Sent",

          provider: "Resend",

          provider_email_id:
            providerEmailId || null,

          error_message:
            errorMessage || null,

          sent_at:
            status === "Sent"
              ? new Date().toISOString()
              : null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(
        "Failed creating email log:",
        error
      );

      return null;
    }

    return data;
  } catch (error) {
    console.error(
      "Unexpected email log error:",
      error
    );

    return null;
  }
}
