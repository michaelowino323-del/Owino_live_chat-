-- OWINO LIVE CHAT DATABASE
-- Run this in Supabase SQL Editor.
-- This script uses lowercase table names to avoid quoting problems.

create extension if not exists pgcrypto;

create type public.user_role as enum ('user','creator','moderator','admin');
create type public.video_status as enum ('draft','published','blocked','removed');
create type public.live_status as enum ('scheduled','live','ended','blocked');
create type public.request_status as enum ('pending','approved','rejected','paid','cancelled');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null default 'Owino Creator',
  bio text,
  avatar_url text,
  role public.user_role not null default 'user',
  verified boolean not null default false,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  likes_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  description text,
  storage_path text not null,
  thumbnail_path text,
  status public.video_status not null default 'published',
  views_count bigint not null default 0,
  likes_count bigint not null default 0,
  comments_count bigint not null default 0,
  shares_count bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.video_likes (
  video_id uuid references public.videos(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(video_id,user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references public.videos(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id,following_id),
  check (follower_id <> following_id)
);

create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  provider text,
  provider_room_id text,
  status public.live_status not null default 'scheduled',
  viewer_count integer not null default 0,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.live_messages (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coins bigint not null default 0,
  available_kes numeric(14,2) not null default 0,
  pending_kes numeric(14,2) not null default 0,
  lifetime_earnings_kes numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check(type in ('coin_purchase','gift_sent','tip_received','withdrawal','refund','adjustment')),
  coins bigint not null default 0,
  amount_kes numeric(14,2) not null default 0,
  reference text unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  coin_price bigint not null check(coin_price > 0),
  creator_share_percent numeric(5,2) not null default 70,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id),
  creator_id uuid not null references public.profiles(id),
  live_id uuid references public.live_streams(id) on delete set null,
  gift_id uuid references public.gifts(id),
  coins bigint not null check(coins > 0),
  amount_kes numeric(14,2) not null default 0,
  platform_fee_kes numeric(14,2) not null default 0,
  creator_earnings_kes numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  identity_status text not null default 'not_submitted',
  status public.request_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  amount_kes numeric(14,2) not null check(amount_kes > 0),
  payout_method text not null check(payout_method in ('mpesa','bank')),
  payout_account text not null,
  status public.request_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  provider_reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  status text not null default 'open',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(id, display_name)
  values(new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  insert into public.wallets(user_id) values(new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.video_likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.live_streams enable row level security;
alter table public.live_messages enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.gifts enable row level security;
alter table public.tips enable row level security;
alter table public.verification_requests enable row level security;
alter table public.withdrawals enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$;

create policy "profiles readable" on public.profiles for select using (true);
create policy "profiles self update" on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());

create policy "published videos readable" on public.videos for select using (status='published' or creator_id=auth.uid() or public.is_admin());
create policy "creators insert videos" on public.videos for insert with check (creator_id=auth.uid());
create policy "creators update videos" on public.videos for update using (creator_id=auth.uid() or public.is_admin());

create policy "likes readable" on public.video_likes for select using (true);
create policy "like own" on public.video_likes for insert with check (user_id=auth.uid());
create policy "unlike own" on public.video_likes for delete using (user_id=auth.uid());

create policy "comments readable" on public.comments for select using (true);
create policy "comments own insert" on public.comments for insert with check (user_id=auth.uid());
create policy "comments own delete" on public.comments for delete using (user_id=auth.uid() or public.is_admin());

create policy "follows readable" on public.follows for select using (true);
create policy "follow own" on public.follows for insert with check (follower_id=auth.uid());
create policy "unfollow own" on public.follows for delete using (follower_id=auth.uid());

create policy "live readable" on public.live_streams for select using (true);
create policy "live creator insert" on public.live_streams for insert with check (creator_id=auth.uid());
create policy "live creator update" on public.live_streams for update using (creator_id=auth.uid() or public.is_admin());

create policy "chat readable" on public.live_messages for select using (true);
create policy "chat insert own" on public.live_messages for insert with check (user_id=auth.uid());

create policy "wallet own read" on public.wallets for select using (user_id=auth.uid() or public.is_admin());
create policy "wallet tx own read" on public.wallet_transactions for select using (user_id=auth.uid() or public.is_admin());

create policy "gifts readable" on public.gifts for select using (active=true or public.is_admin());
create policy "tips own/admin read" on public.tips for select using (sender_id=auth.uid() or creator_id=auth.uid() or public.is_admin());

create policy "verification own/admin read" on public.verification_requests for select using (user_id=auth.uid() or public.is_admin());
create policy "verification own insert" on public.verification_requests for insert with check (user_id=auth.uid());
create policy "verification admin update" on public.verification_requests for update using (public.is_admin());

create policy "withdraw own/admin read" on public.withdrawals for select using (creator_id=auth.uid() or public.is_admin());
create policy "withdraw own insert" on public.withdrawals for insert with check (creator_id=auth.uid());
create policy "withdraw admin update" on public.withdrawals for update using (public.is_admin());

create policy "reports own/admin read" on public.reports for select using (reporter_id=auth.uid() or public.is_admin());
create policy "reports own insert" on public.reports for insert with check (reporter_id=auth.uid());
create policy "reports admin update" on public.reports for update using (public.is_admin());

create policy "notifications own" on public.notifications for select using (user_id=auth.uid());
create policy "notifications own update" on public.notifications for update using (user_id=auth.uid());

-- Realtime for live chat
alter publication supabase_realtime add table public.live_messages;

insert into public.gifts(name,icon,coin_price,creator_share_percent)
values
('Rose','🌹',10,70),
('Heart','❤️',50,70),
('Crown','👑',500,70),
('Diamond','💎',1000,70)
on conflict do nothing;
