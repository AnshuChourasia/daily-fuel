-- Run in Supabase SQL editor. Authenticated accounts only; never use service_role in browser.
create extension if not exists pgcrypto;
create table if not exists public.families (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 60),
 invite_code text not null unique default upper(encode(gen_random_bytes(8),'hex')),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.family_members (
 family_id uuid not null references public.families(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade unique,
 role text not null default 'member' check(role in ('admin','member')),
 display_name text not null default 'Member', protein_goal numeric not null default 70 check(protein_goal>0),
 calorie_goal numeric not null default 2000 check(calorie_goal>0),
 joined_at timestamptz not null default now(), primary key(family_id,user_id)
);
create table if not exists public.food_entries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 log_date date not null, food_name text not null, meal text not null, quantity numeric not null check(quantity>0),
 unit_name text, protein numeric not null check(protein>=0), calories numeric not null check(calories>=0),
 created_at timestamptz not null default now()
);
create index if not exists food_entries_user_date on public.food_entries(user_id,log_date);
-- SECURITY DEFINER helper avoids recursive RLS lookups when checking membership.
create or replace function public.my_family_id() returns uuid language sql stable security definer set search_path = '' as $$
 select family_id from public.family_members where user_id = (select auth.uid()) limit 1;
$$;
revoke all on function public.my_family_id() from public;
grant execute on function public.my_family_id() to authenticated;
create or replace function public.my_family_role() returns text language sql stable security definer set search_path = '' as $$
 select role from public.family_members where user_id = (select auth.uid()) limit 1;
$$;
revoke all on function public.my_family_role() from public;
grant execute on function public.my_family_role() to authenticated;
-- Safe profile projection: exposes no emails or authentication secrets.
create or replace view public.family_member_profiles with (security_invoker=true) as
 select family_id,user_id,role,display_name,protein_goal,calorie_goal from public.family_members;
grant select on public.family_member_profiles to authenticated;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.food_entries enable row level security;
drop policy if exists family_read on public.families;
create policy family_read on public.families for select to authenticated using(id=(select public.my_family_id()));
drop policy if exists members_read on public.family_members;
create policy members_read on public.family_members for select to authenticated using(family_id=(select public.my_family_id()));
drop policy if exists members_update_own on public.family_members;
create policy members_update_own on public.family_members for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and family_id=(select public.my_family_id()));
-- Restrict update columns so users cannot promote themselves or change family membership.
revoke update on public.family_members from authenticated;
grant update (display_name,protein_goal,calorie_goal) on public.family_members to authenticated;
drop policy if exists members_admin_delete on public.family_members;
create policy members_admin_delete on public.family_members for delete to authenticated using(family_id=(select public.my_family_id()) and (select public.my_family_role())='admin' and user_id<>(select auth.uid()));
drop policy if exists entries_family_read on public.food_entries;
create policy entries_family_read on public.food_entries for select to authenticated using(exists(
 select 1 from public.family_members m where m.user_id=food_entries.user_id and m.family_id=(select public.my_family_id())
));
drop policy if exists entries_own_insert on public.food_entries;
create policy entries_own_insert on public.food_entries for insert to authenticated with check(user_id=(select auth.uid()) and (select public.my_family_id()) is not null);
drop policy if exists entries_own_update on public.food_entries;
create policy entries_own_update on public.food_entries for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists entries_own_delete on public.food_entries;
create policy entries_own_delete on public.food_entries for delete to authenticated using(user_id=(select auth.uid()));
-- Prevent clients from changing owner of a food entry.
revoke update on public.food_entries from authenticated;
grant update (log_date,food_name,meal,quantity,unit_name,protein,calories) on public.food_entries to authenticated;
-- Membership and family creation only through guarded RPCs.
revoke insert,update,delete on public.families from anon,authenticated;
revoke insert on public.family_members from anon,authenticated;
create or replace function public.create_family(family_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare fid uuid; username text;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if exists(select 1 from public.family_members where user_id=auth.uid()) then raise exception 'Already in a family'; end if;
 if length(trim(coalesce(family_name,''))) not between 1 and 60 then raise exception 'Invalid family name'; end if;
 username:=coalesce(nullif(trim(auth.jwt()->'user_metadata'->>'display_name'),''),split_part(coalesce(auth.jwt()->>'email','Member'),'@',1));
 insert into public.families(name,created_by) values(trim(family_name),auth.uid()) returning id into fid;
 insert into public.family_members(family_id,user_id,role,display_name) values(fid,auth.uid(),'admin',left(username,60));
 return fid;
end $$;
create or replace function public.join_family(invite_code_input text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare fid uuid; username text;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if exists(select 1 from public.family_members where user_id=auth.uid()) then raise exception 'Already in a family'; end if;
 select id into fid from public.families where invite_code=upper(trim(invite_code_input));
 if fid is null then raise exception 'Invalid invitation code'; end if;
 username:=coalesce(nullif(trim(auth.jwt()->'user_metadata'->>'display_name'),''),split_part(coalesce(auth.jwt()->>'email','Member'),'@',1));
 insert into public.family_members(family_id,user_id,role,display_name) values(fid,auth.uid(),'member',left(username,60));
 return fid;
end $$;
revoke all on function public.create_family(text) from public;
revoke all on function public.join_family(text) from public;
grant execute on function public.create_family(text) to authenticated;
grant execute on function public.join_family(text) to authenticated;
-- Realtime: optional, enabled for food-entry change notifications.
-- alter publication supabase_realtime add table public.food_entries;
