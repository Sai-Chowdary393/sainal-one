export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function textToHtml(value) {
  return escapeHtml(value)
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "<br />");
}

export function getCompanyDisplayName(settings) {
  return settings?.company_name || "SaiNal One";
}

export function getCompanyContactBlock(settings) {
  const parts = [
    settings?.company_name,
    settings?.company_email,
    settings?.company_phone,
    settings?.website,
    settings?.address,
  ].filter(Boolean);

  return parts.map(escapeHtml).join("<br />");
}

export function buildEmailLayout({
  companyName,
  title,
  introductoryText,
  contentHtml,
  footerText,
}) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>
      </head>

      <body
        style="
          margin: 0;
          padding: 0;
          background: #f5f3ee;
          font-family: Arial, Helvetica, sans-serif;
          color: #0b132b;
        "
      >
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="background: #f5f3ee; padding: 30px 15px;"
        >
          <tr>
            <td align="center">
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  max-width: 720px;
                  background: #ffffff;
                  border-radius: 14px;
                  overflow: hidden;
                  border: 1px solid #e5e2da;
                "
              >
                <tr>
                  <td
                    style="
                      background: #1b1b1b;
                      color: #dfb52f;
                      padding: 24px 30px;
                      font-size: 26px;
                      font-weight: 700;
                    "
                  >
                    ${escapeHtml(companyName)}
                  </td>
                </tr>

                <tr>
                  <td style="padding: 30px;">
                    <h1
                      style="
                        margin: 0 0 18px;
                        font-size: 25px;
                        color: #0b132b;
                      "
                    >
                      ${escapeHtml(title)}
                    </h1>

                    ${
                      introductoryText
                        ? `
                          <p
                            style="
                              margin: 0 0 24px;
                              font-size: 16px;
                              line-height: 1.7;
                              color: #4b5563;
                            "
                          >
                            ${textToHtml(introductoryText)}
                          </p>
                        `
                        : ""
                    }

                    <div
                      style="
                        font-size: 15px;
                        line-height: 1.8;
                        color: #111827;
                      "
                    >
                      ${contentHtml}
                    </div>
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding: 22px 30px;
                      background: #faf9f6;
                      border-top: 1px solid #e5e2da;
                      font-size: 13px;
                      line-height: 1.6;
                      color: #6b7280;
                    "
                  >
                    ${textToHtml(
                      footerText ||
                        `This email was sent by ${companyName}.`
                    )}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
