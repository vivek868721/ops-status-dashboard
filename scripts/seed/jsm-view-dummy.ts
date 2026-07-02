#!/usr/bin/env bun
/**
 * Creates v_jsm_sr_cr_oc as a TABLE (stand-in for the real JSM view)
 * and seeds it with demo data for all 5 tenants.
 */
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL required"); process.exit(1); }
const sql = postgres(DATABASE_URL);

// Create the table (mirrors the real view shape)
await sql.unsafe(`
  CREATE TABLE IF NOT EXISTS v_jsm_sr_cr_oc (
    tenant_id         BIGINT,
    issue_type        TEXT,
    issue_key         TEXT PRIMARY KEY,
    title             TEXT,
    status_category   TEXT,
    service_level     TEXT,
    urgency_yn        TEXT,
    assignee_id       TEXT,
    assignee_name     TEXT,
    issue_create_date TIMESTAMP,
    resolution_date   TIMESTAMP,
    due_date          TIMESTAMP,
    is_ontime         BOOLEAN,
    total_leadtime    NUMERIC,
    chg_category      TEXT,
    chg_purpose       TEXT,
    chg_charge_of     TEXT,
    chg_req_by        TEXT,
    req_class         TEXT,
    req_type          TEXT,
    cancel_reason     TEXT,
    stop_reason       TEXT,
    company           TEXT,
    company_key       TEXT,
    client_company    TEXT,
    client_name       TEXT
  )
`);
console.log("✓ v_jsm_sr_cr_oc table created");

const [{ cnt }] = await sql`SELECT COUNT(*) as cnt FROM v_jsm_sr_cr_oc`;
if (Number(cnt) > 0) {
  console.log(`Already has ${cnt} rows — skipping seed.`);
  await sql.end(); process.exit(0);
}

const now = new Date();
const d = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000);

const rows = [
  // ── Acme Corp (tenant 1) — SR ────────────────────────────────────────────
  [1,'SR','SR-1001','Password reset not working','Done','Standard','N','USR001','Alice Johnson',d(10),d(8),d(9),true,2,null,null,null,null,'Incident','Break-Fix',null,null,'Acme Corp','ACME','Acme Corp','John Doe'],
  [1,'SR','SR-1002','VPN disconnects every hour','In Progress','Standard','Y','USR002','Bob Smith',d(5),null,d(3),false,null,null,null,null,null,'Incident','Break-Fix',null,null,'Acme Corp','ACME','Acme Corp','Jane Roe'],
  [1,'SR','SR-1003','New laptop setup request','Done','Standard','N','USR001','Alice Johnson',d(20),d(18),d(19),true,2,null,null,null,null,'Standard','New Equipment',null,null,'Acme Corp','ACME','Acme Corp','Mark Lee'],
  [1,'SR','SR-1004','Email not syncing on mobile','Done','Standard','N','USR003','Carol White',d(15),d(14),d(16),true,1,null,null,null,null,'Incident','Break-Fix',null,null,'Acme Corp','ACME','Acme Corp','Sara Kim'],
  [1,'SR','SR-1005','Printer offline in office','Open','Standard','N','USR002','Bob Smith',d(2),null,d(1),false,null,null,null,null,null,'Incident','Break-Fix',null,null,'Acme Corp','ACME','Acme Corp','Tom Park'],
  // ── Acme Corp (tenant 1) — CR ────────────────────────────────────────────
  [1,'CR','CR-1001','Deploy auth service v2.1','Done','Standard','N','USR004','Dave Brown',d(25),d(22),d(24),true,3,'Normal','Improvement',null,null,null,null,null,null,'Acme Corp','ACME','Acme Corp','IT Dept'],
  [1,'CR','CR-1002','Database index optimization','In Progress','Standard','Y','USR004','Dave Brown',d(3),null,d(2),false,null,'Emergency','Bug Fix',null,null,null,null,null,null,'Acme Corp','ACME','Acme Corp','DBA Team'],
  [1,'CR','CR-1003','Upgrade Node.js to v20','Done','Standard','N','USR005','Eve Davis',d(30),d(27),d(29),true,3,'Normal','Upgrade',null,null,null,null,null,null,'Acme Corp','ACME','Acme Corp','Dev Team'],
  [1,'CR','CR-1004','Add rate limiting to API','Open','Standard','N','USR005','Eve Davis',d(7),null,d(5),false,null,'Normal','Security',null,null,null,null,null,null,'Acme Corp','ACME','Acme Corp','Security Team'],
  // ── Acme Corp (tenant 1) — OC ────────────────────────────────────────────
  [1,'OC','OC-1001','Server room maintenance','Done','Standard','N','USR006','Frank Wilson',d(14),d(13),d(14),true,1,null,null,'IT Ops',null,null,null,null,null,'Acme Corp','ACME','Acme Corp','Facilities'],
  [1,'OC','OC-1002','Network switch replacement','Done','Standard','Y','USR006','Frank Wilson',d(8),d(7),d(9),true,2,null,null,'IT Ops',null,null,null,null,null,'Acme Corp','ACME','Acme Corp','Network Team'],
  [1,'OC','OC-1003','SSL certificate renewal','Open','Standard','Y','USR007','Grace Taylor',d(1),null,d(0),false,null,null,null,'IT Ops',null,null,null,null,null,'Acme Corp','ACME','Acme Corp','Security'],
  // ── GlobalTech (tenant 2) — SR ───────────────────────────────────────────
  [2,'SR','SR-2001','Access to analytics portal','Done','Standard','N','USR010','Henry Ford',d(12),d(10),d(11),true,2,null,null,null,null,'Standard','Access Request',null,null,'GlobalTech','GTECH','GlobalTech','Product Team'],
  [2,'SR','SR-2002','Slack integration broken','In Progress','Standard','Y','USR011','Iris Chen',d(4),null,d(2),false,null,null,null,null,null,'Incident','Break-Fix',null,null,'GlobalTech','GTECH','GlobalTech','Marketing'],
  [2,'SR','SR-2003','Request new monitor setup','Done','Standard','N','USR010','Henry Ford',d(18),d(16),d(17),true,2,null,null,null,null,'Standard','New Equipment',null,null,'GlobalTech','GTECH','GlobalTech','Design Team'],
  [2,'CR','CR-2001','Migrate to AWS us-east-2','Done','Standard','N','USR012','Jack Ma',d(45),d(40),d(44),true,5,'Normal','Migration',null,null,null,null,null,null,'GlobalTech','GTECH','GlobalTech','Infra Team'],
  [2,'CR','CR-2002','Enable MFA for all users','In Progress','Standard','Y','USR012','Jack Ma',d(5),null,d(3),false,null,'Normal','Security',null,null,null,null,null,null,'GlobalTech','GTECH','GlobalTech','Security'],
  [2,'OC','OC-2001','Data center cooling check','Done','Standard','N','USR013','Kate Liu',d(20),d(19),d(20),true,1,null,null,'Infra',null,null,null,null,null,'GlobalTech','GTECH','GlobalTech','Facilities'],
  // ── Nexus Solutions (tenant 3) ───────────────────────────────────────────
  [3,'SR','SR-3001','CRM login issue','Done','Standard','N','USR020','Leo Park',d(9),d(8),d(9),true,1,null,null,null,null,'Incident','Break-Fix',null,null,'Nexus Solutions','NEXUS','Nexus Solutions','Sales'],
  [3,'SR','SR-3002','Report generation slow','Open','Standard','N','USR021','Mia Patel',d(3),null,d(1),false,null,null,null,null,null,'Performance','Degradation',null,null,'Nexus Solutions','NEXUS','Nexus Solutions','BI Team'],
  [3,'CR','CR-3001','Upgrade PostgreSQL 15→17','Done','Standard','N','USR022','Noah Kim',d(35),d(31),d(34),true,4,'Normal','Upgrade',null,null,null,null,null,null,'Nexus Solutions','NEXUS','Nexus Solutions','DBA'],
  // ── Zenith Industries (tenant 4) ─────────────────────────────────────────
  [4,'SR','SR-4001','Firewall blocking internal tool','Done','Standard','Y','USR030','Olivia Ray',d(6),d(5),d(6),true,1,null,null,null,null,'Incident','Break-Fix',null,null,'Zenith Industries','ZENITH','Zenith Industries','Network'],
  [4,'CR','CR-4001','Deploy ERP patch 4.2.1','Open','Standard','N','USR031','Paul Green',d(2),null,d(1),false,null,'Normal','Patch',null,null,null,null,null,null,'Zenith Industries','ZENITH','Zenith Industries','ERP Team'],
  // ── Aurora Systems (tenant 5) ────────────────────────────────────────────
  [5,'SR','SR-5001','2FA not sending SMS','Done','Standard','Y','USR040','Quinn Bell',d(11),d(10),d(11),true,1,null,null,null,null,'Incident','Break-Fix',null,null,'Aurora Systems','AURORA','Aurora Systems','Support'],
  [5,'CR','CR-5001','Kubernetes cluster upgrade','Done','Standard','N','USR041','Rachel Ng',d(28),d(24),d(27),true,4,'Normal','Upgrade',null,null,null,null,null,null,'Aurora Systems','AURORA','Aurora Systems','Platform'],
];

for (const r of rows) {
  await sql`
    INSERT INTO v_jsm_sr_cr_oc (
      tenant_id, issue_type, issue_key, title, status_category, service_level,
      urgency_yn, assignee_id, assignee_name, issue_create_date, resolution_date,
      due_date, is_ontime, total_leadtime, chg_category, chg_purpose,
      chg_charge_of, chg_req_by, req_class, req_type, cancel_reason,
      stop_reason, company, company_key, client_company, client_name
    ) VALUES (
      ${r[0]}, ${r[1]}, ${r[2]}, ${r[3]}, ${r[4]}, ${r[5]},
      ${r[6]}, ${r[7]}, ${r[8]}, ${r[9] as Date}, ${r[10] as Date | null},
      ${r[11] as Date | null}, ${r[12] as boolean}, ${r[13] as number | null},
      ${r[14]}, ${r[15]}, ${r[16]}, ${r[17]}, ${r[18]}, ${r[19]},
      ${r[20]}, ${r[21]}, ${r[22]}, ${r[23]}, ${r[24]}, ${r[25]}
    )
  `;
}

console.log(`✓ v_jsm_sr_cr_oc: ${rows.length} rows seeded across 5 tenants`);
await sql.end();
