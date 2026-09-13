import { NextResponse } from "next/server";

export async function GET() {
  return new NextResponse(
    `
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>اتصال Facebook</title>
        </head>

        <body>
          <div style="
            min-height:100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            font-family:Arial,sans-serif;
            text-align:center;
          ">
            <div>
              <h2>در حال تکمیل اتصال...</h2>
              <p id="status">لطفاً صبر کنید.</p>
            </div>
          </div>

          <script>
            (() => {
              const status = document.getElementById("status");

              const hash = window.location.hash.substring(1);
              const params = new URLSearchParams(hash);

              const accessToken = params.get("access_token");
              const longLivedToken = params.get("long_lived_token");
              const expiresIn = params.get("expires_in");
              const dataAccessExpirationTime = params.get(
                "data_access_expiration_time"
              );

              if (!accessToken && !longLivedToken) {
                status.textContent =
                  "توکن دریافت نشد. ممکن است اتصال لغو شده باشد.";
                return;
              }

              const token =
                longLivedToken || accessToken;

              const target =
                "/api/instagram/facebook-callback/complete";

              const query = new URLSearchParams({
                token,
                ...(expiresIn ? { expiresIn } : {}),
                ...(dataAccessExpirationTime
                  ? { dataAccessExpirationTime }
                  : {}),
              });

              window.location.href =
                target + "?" + query.toString();
            })();
          </script>
        </body>
      </html>
    `,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
