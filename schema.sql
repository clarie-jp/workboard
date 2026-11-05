-- 買取・出品ワークボード：Supabase の SQL Editor に貼り付けて1回だけ実行してください
create table if not exists staff (
  id uuid primary key,
  name text not null,
  role text not null check (role in ('buyer', 'part')),
  store text not null default '',
  active boolean not null default true,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create table if not exists attendance (
  id text primary key,
  staff_id uuid not null references staff(id) on delete cascade,
  date date not null,
  month text not null,
  clock_in text not null default '',
  clock_out text not null default '',
  break_min int not null default 0,
  now_label text not null default '',
  now_since text not null default '',
  updated_at bigint
);
create table if not exists logs (
  id uuid primary key,
  staff_id uuid not null references staff(id) on delete cascade,
  date date not null,
  month text not null,
  task text not null check (task in ('出品', '梱包', '発送', '整理')),
  hours numeric not null,
  count int not null default 0,
  created_at bigint
);
create table if not exists appos (
  id uuid primary key,
  staff_id uuid not null references staff(id) on delete cascade,
  date date not null,
  month text not null,
  type text not null check (type in ('unisound', 'mansion')),
  title text not null default '',
  target int not null,
  created_at bigint
);
create table if not exists profits (
  id uuid primary key,
  appo_id uuid not null references appos(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  date date not null,
  month text not null,
  amount int not null,
  note text not null default '',
  at text not null default '',
  created_at bigint
);
create index if not exists attendance_month on attendance(month);
create index if not exists logs_month on logs(month);
create index if not exists appos_month on appos(month);
create index if not exists profits_month on profits(month);

-- リンクを知っている人は誰でも使える（ログインなし）設定
do $$
declare t text;
begin
  foreach t in array array['staff','attendance','logs','appos','profits'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists open_access on %I', t);
    execute format('create policy open_access on %I for all to anon, authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on %I to anon, authenticated', t);
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
