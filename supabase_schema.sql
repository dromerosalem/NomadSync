-- Enable Row Level Security
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  avatar_url text,
  class_level text default 'Pathfinder',
  total_miles float default 0.0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Trips Table
create table public.trips (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  destination text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  cover_image_url text,
  status text default 'PLANNING' check (status in ('PLANNING', 'IN_PROGRESS', 'COMPLETE')),
  budget_view_mode text default 'SMART' check (budget_view_mode in ('SMART', 'DIRECT')),
  base_currency text default 'USD',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Trip Members (Join Table)
create table public.trip_members (
  trip_id uuid references public.trips(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'PASSENGER' check (role in ('PATHFINDER', 'SCOUT', 'PASSENGER')),
  personal_budget float default 0.0,
  status text default 'PENDING' check (status in ('ACTIVE', 'PENDING', 'BLOCKED')),
  pending_expense_invite boolean default false,
  created_at timestamptz default now(),
  primary key (trip_id, user_id)
);

-- 4. Itinerary Items
create table public.itinerary_items (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips(id) on delete cascade,
  type text not null check (type in ('STAY', 'TRANSPORT', 'ACTIVITY', 'FOOD', 'ESSENTIALS', 'SETTLEMENT')),
  title text not null,
  location text,
  end_location text,
  start_date timestamptz not null,
  end_date timestamptz,
  duration_minutes int,
  cost float default 0.0,
  paid_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  is_private boolean default false,
  show_in_timeline boolean default true,
  details text,
  map_uri text,
  tags text[],
  original_amount float,
  currency_code text,
  exchange_rate float,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. Expense Splits
create table public.expense_splits (
  item_id uuid references public.itinerary_items(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  amount float not null,
  primary key (item_id, user_id)
);

-- 6. Application Logs
create table public.app_logs (
  id uuid default uuid_generate_v4() primary key,
  event_name text not null,
  user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb,
  created_at timestamptz default now()
);

-- TRIGGERS --

-- Function to create profile on user signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call handle_new_user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Updated_at trigger function
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Apply updated_at to tables
create trigger update_profiles_updated_at before update on public.profiles for each row execute procedure update_updated_at_column();
create trigger update_trips_updated_at before update on public.trips for each row execute procedure update_updated_at_column();
create trigger update_itinerary_items_updated_at before update on public.itinerary_items for each row execute procedure update_updated_at_column();

-- RLS POLICIES --

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.expense_splits enable row level security;
alter table public.app_logs enable row level security;

-- Profiles: Public select (for invites), Self update
create policy "Public profiles are viewable by everyone." on public.profiles
  for select using ( true );

create policy "Users can update own profile." on public.profiles
  for update using ( auth.uid() = id );

-- Trips: Members can view
create policy "Members can view trips" on public.trips
  for select using (
    exists (
      select 1 from public.trip_members
      where trip_id = public.trips.id and user_id = auth.uid()
    )
  );

-- Only authenticated users can create trips
create policy "Authenticated users can create trips" on public.trips
  for insert with check ( auth.role() = 'authenticated' );

-- Pathfinders and Scouts can update trips
create policy "Pathfinders and scouts can update trips" on public.trips
  for update using (
    exists (
      select 1 from public.trip_members
      where trip_id = public.trips.id and user_id = auth.uid() and role in ('PATHFINDER', 'SCOUT')
    )
  );

-- Trip Members: Members can view their trip circle
create policy "Members can view trip circle" on public.trip_members
  for select using (
    exists (
      select 1 from public.trip_members as tm
      where tm.trip_id = public.trip_members.trip_id and tm.user_id = auth.uid()
    )
  );

-- Itinerary Items
create policy "Members can view non-private items" on public.itinerary_items
  for select using (
    exists (
      select 1 from public.trip_members
      where trip_id = public.itinerary_items.trip_id and user_id = auth.uid()
    ) and (is_private = false or created_by = auth.uid())
  );

create policy "Pathfinders and scouts can manage items" on public.itinerary_items
  for all using (
    exists (
      select 1 from public.trip_members
      where trip_id = public.itinerary_items.trip_id and user_id = auth.uid() and role in ('PATHFINDER', 'SCOUT')
    ) or created_by = auth.uid()
  );

-- Expense Splits
create policy "Members can view splits for visible items" on public.expense_splits
  for select using (
    exists (
      select 1 from public.itinerary_items
      where id = item_id
    )
  );

create policy "Members can insert splits for items in their trips" on public.expense_splits
  for insert with check (
    exists (
      select 1 from public.itinerary_items ii
      join public.trip_members tm on tm.trip_id = ii.trip_id
      where ii.id = item_id and tm.user_id = auth.uid()
    )
  );

create policy "Members can delete splits for items in their trips" on public.expense_splits
  for delete using (
    exists (
      select 1 from public.itinerary_items ii
      join public.trip_members tm on tm.trip_id = ii.trip_id
      where ii.id = item_id and tm.user_id = auth.uid()
    )
  );

-- Application Logs
create policy "Authenticated users can insert logs" on public.app_logs
  for insert with check ( auth.role() = 'authenticated' );

-- RPCs --

create or replace function public.get_trip_balances(trip_uuid uuid)
returns json as $$
declare
    result json;
begin
    with credits as (
        select paid_by as user_id, sum(cost) as total_paid
        from public.itinerary_items
        where trip_id = trip_uuid and is_private = false
        group by paid_by
    ),
    debits as (
        select es.user_id, sum(es.amount) as total_owed
        from public.expense_splits es
        join public.itinerary_items ii on ii.id = es.item_id
        where ii.trip_id = trip_uuid and ii.is_private = false
        group by es.user_id
    )
    select json_object_agg(m.user_id, coalesce(c.total_paid, 0) - coalesce(d.total_owed, 0))
    into result
    from public.trip_members m
    left join credits c on c.user_id = m.user_id
    left join debits d on d.user_id = m.user_id
    where m.trip_id = trip_uuid;
    
    return result;
end;
$$ language plpgsql security definer;
