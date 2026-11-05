-- 買取・出品ワークボード：追加機能用（社員（管理）・勤務場所・タスク・暗証番号・出品表の自動集計）
-- Supabase の SQL Editor に貼り付けて1回だけ実行してください（何度実行しても安全です）
alter table staff add column if not exists pin_hash text not null default '';
alter table staff drop constraint if exists staff_role_check;
alter table staff add constraint staff_role_check check (role in ('buyer', 'office', 'part'));
alter table attendance add column if not exists place text not null default '';

create table if not exists tasks (
  id uuid primary key,
  staff_id uuid not null references staff(id) on delete cascade,
  title text not null,
  note text not null default '',
  due_date date,
  due_time text not null default '',
  done boolean not null default false,
  done_at bigint,
  created_at bigint
);
create index if not exists tasks_staff on tasks(staff_id);

alter table tasks enable row level security;
drop policy if exists open_access on tasks;
create policy open_access on tasks for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on tasks to anon, authenticated;
do $$ begin
  alter publication supabase_realtime add table tasks;
exception when duplicate_object then null;
end $$;

-- 出品表の自動集計
alter table staff add column if not exists listing_code text not null default '';
create table if not exists listing_counts (
  id text primary key,
  store text not null,
  code text not null,
  date date not null,
  month text not null,
  count int not null default 0,
  updated_at bigint
);
create index if not exists listing_counts_month on listing_counts(month);
alter table listing_counts enable row level security;
drop policy if exists open_access on listing_counts;
create policy open_access on listing_counts for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on listing_counts to anon, authenticated;
do $$ begin
  alter publication supabase_realtime add table listing_counts;
exception when duplicate_object then null;
end $$;

-- 出品表の行データ（数え方のルールはアプリ側で判定）
create table if not exists listing_rows (
  id text primary key,
  store text not null,
  row_no int not null,
  code text not null default '',
  date date not null,
  month text not null,
  status text not null default '',
  filled text not null default '',
  updated_at bigint
);
create index if not exists listing_rows_month on listing_rows(month);
alter table listing_rows enable row level security;
drop policy if exists open_access on listing_rows;
create policy open_access on listing_rows for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on listing_rows to anon, authenticated;
do $$ begin
  alter publication supabase_realtime add table listing_rows;
exception when duplicate_object then null;
end $$;
alter table listing_rows add column if not exists no text not null default '';
alter table listing_rows add column if not exists title text not null default '';
