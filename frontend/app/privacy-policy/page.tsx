import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Sapang Palay Tricycle Service Cooperative (SPTC) handles information in this web application.",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-svh bg-page">
      <div className="mx-auto max-w-2xl px-6 py-10 md:py-14">
        <p className="mb-6 text-sm text-muted-foreground">
          <Link
            href="/login"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Back to login
          </Link>
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sapang Palay Tricycle Service Cooperative (SPTC) — web application
        </p>

        <div className="mt-10 space-y-8 text-sm">
          <section className="scroll-mt-20 space-y-3" id="intro">
            <h2 className="text-lg font-semibold text-foreground">
            Introduction
          </h2>
          <p className="text-muted-foreground">
            This policy describes how information is handled when you use the
            SPTC cooperative management web application (the &quot;App&quot;).
            The App helps authorized staff and administrators manage cooperative
            records—including members, drivers, financial data, operations
            documents, and system activity—for cooperative business purposes.
          </p>
          </section>

          <section className="scroll-mt-20 space-y-3" id="scope">
            <h2 className="text-lg font-semibold text-foreground">
            Who this applies to
          </h2>
          <p className="text-muted-foreground">
            The App is intended for cooperative personnel with issued accounts
            (staff and administrator roles). If you are not an authorized user,
            do not attempt to access the App. Information entered about members
            and drivers is processed to support cooperative operations under the
            direction of SPTC.
          </p>
          </section>

          <section className="scroll-mt-20 space-y-3" id="data">
            <h2 className="text-lg font-semibold text-foreground">
            Information we process
          </h2>
          <p className="text-muted-foreground">
            Depending on how you use the App, the following categories of
            information may be collected or stored in our systems:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Account data:</span>{" "}
              username, role, name, and a
              password handled by the server for authentication (stored using a
              one-way hash, e.g. bcrypt, rather than in plain text).
            </li>
            <li>
              <span className="font-medium text-foreground">
                Member and driver records:
              </span>{" "}
              names, birthdays,
              addresses, contact numbers, tax identification (TIN) digits,
              cooperative identifiers (such as body and precinct numbers),
              profile images, and related operational or financial fields
              maintained for cooperative management.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Financial and operational records:
              </span>{" "}
              savings,
              loans, contributions (butaw), arkilahan, suspensions, lipatan
              (transfer) history, and similar cooperative data linked to members
              or units.
            </li>
            <li>
              <span className="font-medium text-foreground">Documents:</span>{" "}
              URLs or references to uploaded files
              (for example member photos, lipatan documents, and operations
              documents such as MTOP or LTO-related files), including prior
              versions where the App keeps a history.
            </li>
            <li>
              <span className="font-medium text-foreground">Audit trail:</span>{" "}
              when certain actions occur, the
              system may record the module, action type, description, the
              acting user&apos;s name and role, request path, HTTP method, and
              timestamp to support accountability and review.
            </li>
          </ul>
          </section>

          <section className="scroll-mt-20 space-y-3" id="local">
            <h2 className="text-lg font-semibold text-foreground">
            Your device (browser)
          </h2>
          <p className="text-muted-foreground">
            After a successful sign-in, the App may store limited account
            information (such as your name, username, and role) in the
            browser&apos;s local storage so the session can be recognized for
            API requests and the user interface. This storage is specific to
            your browser and device; signing out or clearing site data removes
            it from that browser.
          </p>
          </section>

          <section className="scroll-mt-20 space-y-3" id="purposes">
            <h2 className="text-lg font-semibold text-foreground">
            How we use information
          </h2>
          <p className="text-muted-foreground">
            We use the information above to:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Authenticate authorized users and enforce role-appropriate access.</li>
            <li>
              Maintain accurate cooperative records for members, drivers, and
              units.
            </li>
            <li>
              Track financial and operational activities required for cooperative
              administration.
            </li>
            <li>
              Store and display documents needed for operations (for example
              compliance-related files).
            </li>
            <li>
              Record significant actions in an audit trail for transparency and
              internal review.
            </li>
          </ul>
          </section>

          <section className="scroll-mt-20 space-y-3" id="sharing">
            <h2 className="text-lg font-semibold text-foreground">
            Service providers & hosting
          </h2>
          <p className="text-muted-foreground">
            File uploads in the App may be processed through a third-party file
            hosting service (UploadThing) so images and documents can be stored
            and served via URLs used by the application. Our backend and database
            run on infrastructure chosen by SPTC or its technical
            administrators; that environment receives the data described above
            when you use the App.
          </p>
          </section>

          <section className="scroll-mt-20 space-y-3" id="retention">
            <h2 className="text-lg font-semibold text-foreground">Retention</h2>
          <p className="text-muted-foreground">
            Records are retained for as long as they are needed for cooperative
            operations, legal or regulatory obligations, and legitimate
            business purposes of SPTC. Specific retention periods may follow
            cooperative policy or applicable law; contact SPTC administration for
            questions about deletion or archival practice.
          </p>
          </section>

          <section className="scroll-mt-20 space-y-3" id="security">
            <h2 className="text-lg font-semibold text-foreground">Security</h2>
          <p className="text-muted-foreground">
            Access to the App should use secure connections (HTTPS) in
            production. Credentials and personal data should only be handled by
            authorized personnel. Administrators are responsible for account
            provisioning, password resets, and access control in line with
            cooperative policy.
          </p>
          </section>

          <section className="scroll-mt-20 space-y-3" id="rights">
            <h2 className="text-lg font-semibold text-foreground">
            Your choices & contact
          </h2>
          <p className="text-muted-foreground">
            If you are a cooperative member or driver whose information appears
            in the App, questions or requests regarding your data should be
            directed to SPTC administrators. Cooperative staff should use
            internal channels for access issues (including password resets via
            an administrator).
          </p>
          </section>

          <section className="scroll-mt-20 space-y-3" id="changes">
            <h2 className="text-lg font-semibold text-foreground">Changes</h2>
          <p className="text-muted-foreground">
            SPTC may update this policy when the App or data practices change.
            The in-app link on the login page will reflect the current policy;
            continued use of the App after changes constitutes acceptance of
            the updated policy where permitted by law.
          </p>
          </section>
        </div>
      </div>
    </div>
  )
}
